from flask import Blueprint, request, redirect, url_for, session, flash, jsonify
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import requests
import json
import os
from datetime import datetime, timedelta
from database import db, User, GoogleToken, FacebookToken, UserAccount
from config import Config

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

# Fix for development - allow HTTP
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Google OAuth Flow
def create_google_flow():
    """יצירת Google OAuth flow"""
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": Config.GOOGLE_CLIENT_ID,
                "client_secret": Config.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [Config.GOOGLE_REDIRECT_URI]
            }
        },
        scopes=Config.GOOGLE_SCOPES
    )
    flow.redirect_uri = Config.GOOGLE_REDIRECT_URI
    return flow

@auth_bp.route('/google')
def google_login():
    """התחלת התחברות עם Google"""
    try:
        # ניקוי session קיים
        session.pop('oauth_state', None)
        
        flow = create_google_flow()
        authorization_url, state = flow.authorization_url(
            access_type='offline',  # נדרש לקבלת refresh token
            include_granted_scopes='true',
            prompt='consent'  # רק prompt, בלי approval_prompt
        )
        
        # שמירת state ב-session לאימות
        session['oauth_state'] = state
        return redirect(authorization_url)
        
    except Exception as e:
        flash(f'שגיאה בהתחברות לגוגל: {str(e)}', 'error')
        return redirect(url_for('login'))

@auth_bp.route('/google/callback')
def google_callback():
    """טיפול בתגובה מגוגל"""
    try:
        # בדיקת state לאבטחה
        if 'oauth_state' not in session or request.args.get('state') != session['oauth_state']:
            flash('שגיאת אבטחה - נסה שוב', 'error')
            return redirect(url_for('login'))
        
        # אם המשתמש ביטל
        if 'error' in request.args:
            flash('ההתחברות בוטלה', 'warning')
            return redirect(url_for('login'))
        
        # קבלת authorization code
        code = request.args.get('code')
        if not code:
            flash('לא התקבל קוד הרשאה מגוגל', 'error')
            return redirect(url_for('login'))
        
        # החלפת code ב-tokens
        flow = create_google_flow()
        flow.fetch_token(authorization_response=request.url)
        
        credentials = flow.credentials
        
        # קבלת פרטי המשתמש מגוגל
        user_info = get_google_user_info(credentials)
        if not user_info:
            flash('לא ניתן לקבל פרטי משתמש מגוגל', 'error')
            return redirect(url_for('login'))
        
        # יצירת או עדכון משתמש
        user = create_or_update_user(user_info, 'google')
        
        # שמירת Google tokens
        save_google_tokens(user.id, credentials)
        
        # קבלת חשבונות Google Analytics ו-Search Console
        fetch_google_accounts(user.id, credentials)
        
        # התחברות המשתמש
        session['user_id'] = user.id
        session['user_email'] = user.email
        session['user_name'] = user.name
        
        flash(f'ברוך הבא {user.name}! התחברת בהצלחה עם Google', 'success')
        return redirect(url_for('dashboard'))
        
    except Exception as e:
        print(f"Google callback error: {e}")
        flash(f'שגיאה בהתחברות: {str(e)}', 'error')
        return redirect(url_for('login'))

def get_google_user_info(credentials):
    """קבלת פרטי משתמש מ-Google"""
    try:
        # בניית service לקבלת פרטי משתמש
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        
        return {
            'google_id': user_info.get('id'),
            'email': user_info.get('email'),
            'name': user_info.get('name'),
            'picture': user_info.get('picture')
        }
    except Exception as e:
        print(f"Error getting Google user info: {e}")
        return None

def save_google_tokens(user_id, credentials):
    """שמירת Google tokens במסד הנתונים"""
    try:
        # מחיקת tokens קיימים
        GoogleToken.query.filter_by(user_id=user_id).delete()
        
        # יצירת token חדש
        expires_at = None
        if credentials.expiry:
            expires_at = credentials.expiry
        
        google_token = GoogleToken(
            user_id=user_id,
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            token_uri=credentials.token_uri,
            client_id=credentials.client_id,
            client_secret=credentials.client_secret,
            expires_at=expires_at
        )
        
        # שמירת הscopes שאכן התקבלו - ממיינים לעקביות
        actual_scopes = sorted(credentials.scopes) if credentials.scopes else sorted(Config.GOOGLE_SCOPES)
        google_token.set_scopes(actual_scopes)
        
        db.session.add(google_token)
        db.session.commit()
        
        print("✅ Google tokens saved successfully")
        print(f"📝 Scopes saved: {actual_scopes}")
        
    except Exception as e:
        print(f"Error saving Google tokens: {e}")
        db.session.rollback()

def fetch_google_accounts(user_id, credentials):
    """קבלת רשימת חשבונות Google Analytics ו-Search Console"""
    try:
        # מחיקת חשבונות Google קיימים
        UserAccount.query.filter_by(user_id=user_id).filter(
            UserAccount.account_type.in_(['google_analytics', 'search_console'])
        ).delete()
        
        # Google Analytics - קבלת רשימת חשבונות
        try:
            # Analytics Data API v1 - החדש יותר
            from googleapiclient.discovery import build
            analytics = build('analyticsdata', 'v1beta', credentials=credentials)
            
            # או Analytics Reporting API v4 - הישן יותר אבל יציב
            analytics_reporting = build('analyticsreporting', 'v4', credentials=credentials)
            
            # ננסה גם Analytics Admin API לקבלת רשימת properties
            try:
                analytics_admin = build('analyticsadmin', 'v1beta', credentials=credentials)
                
                # קבלת רשימת accounts
                accounts_response = analytics_admin.accounts().list().execute()
                
                for account in accounts_response.get('accounts', []):
                    account_id = account['name'].split('/')[-1]  # לקבל רק את המספר
                    
                    # קבלת properties לחשבון הזה
                    try:
                        properties_response = analytics_admin.properties().list(
                            filter=f'parent:{account["name"]}'
                        ).execute()
                        
                        for property_data in properties_response.get('properties', []):
                            property_id = property_data['name'].split('/')[-1]
                            website_url = property_data.get('websiteUrl', '')
                            display_name = property_data.get('displayName', f'Property {property_id}')
                            
                            account_record = UserAccount(
                                user_id=user_id,
                                account_type='google_analytics',
                                account_id=property_id,
                                account_name=f"{display_name} ({account.get('displayName', 'Unknown Account')})",
                                website_url=website_url,
                                is_active=False  # משתמש יבחר מה לחבר
                            )
                            db.session.add(account_record)
                            
                    except Exception as prop_error:
                        print(f"Error fetching properties for account {account_id}: {prop_error}")
                        continue
                        
                print(f"📊 Found {len(accounts_response.get('accounts', []))} Analytics accounts")
                
            except Exception as admin_error:
                print(f"Analytics Admin API error: {admin_error}")
                print("💡 Tip: Enable Analytics Admin API in Google Cloud Console")
                # לא נוסיף חשבון דמו - נתן למשתמש לדעת מה הבעיה
                
        except Exception as e:
            print(f"Analytics API error: {e}")
        
        # Google Search Console  
        try:
            search_console = build('searchconsole', 'v1', credentials=credentials)
            print("🔍 Search Console service created successfully")
            
            sites = search_console.sites().list().execute()
            print(f"📋 Search Console response: {sites}")
            
            site_entries = sites.get('siteEntry', [])
            print(f"📈 Found {len(site_entries)} Search Console sites")
            
            for site in site_entries:
                site_url = site['siteUrl']
                permission_level = site.get('permissionLevel', 'unknown')
                
                print(f"  - Site: {site_url}, Permission: {permission_level}")
                
                account = UserAccount(
                    user_id=user_id,
                    account_type='search_console',
                    account_id=site_url,
                    account_name=f"{site_url} ({permission_level})",
                    website_url=site_url,
                    is_active=False  # משתמש יבחר מה לחבר
                )
                db.session.add(account)
            
        except Exception as e:
            print(f"Search Console API error: {e}")
            print(f"Error type: {type(e)}")
            print("💡 Tip: Check if Search Console API is enabled")
        
        db.session.commit()
        
    except Exception as e:
        print(f"Error fetching Google accounts: {e}")
        db.session.rollback()

# Facebook OAuth
@auth_bp.route('/facebook')
def facebook_login():
    """התחלת התחברות עם Facebook"""
    try:
        facebook_url = (
            f"https://www.facebook.com/v18.0/dialog/oauth?"
            f"client_id={Config.FACEBOOK_APP_ID}&"
            f"redirect_uri={Config.FACEBOOK_REDIRECT_URI}&"
            f"scope={','.join(Config.FACEBOOK_PERMISSIONS)}&"
            f"response_type=code&"
            f"state=facebook_auth"
        )
        
        session['facebook_state'] = 'facebook_auth'
        return redirect(facebook_url)
        
    except Exception as e:
        flash(f'שגיאה בהתחברות לפייסבוק: {str(e)}', 'error')
        return redirect(url_for('main.dashboard'))

@auth_bp.route('/facebook/callback')
def facebook_callback():
    """טיפול בתגובה מפייסבוק"""
    try:
        # בדיקת state
        if request.args.get('state') != session.get('facebook_state'):
            flash('שגיאת אבטחה בפייסבוק', 'error')
            return redirect(url_for('main.dashboard'))
        
        # אם המשתמש ביטל
        if 'error' in request.args:
            flash('ההתחברות לפייסבוק בוטלה', 'warning')
            return redirect(url_for('main.dashboard'))
        
        code = request.args.get('code')
        if not code:
            flash('לא התקבל קוד הרשאה מפייסבוק', 'error')
            return redirect(url_for('main.dashboard'))
        
        # קבלת access token
        token_url = (
            f"https://graph.facebook.com/v18.0/oauth/access_token?"
            f"client_id={Config.FACEBOOK_APP_ID}&"
            f"client_secret={Config.FACEBOOK_APP_SECRET}&"
            f"redirect_uri={Config.FACEBOOK_REDIRECT_URI}&"
            f"code={code}"
        )
        
        response = requests.get(token_url)
        token_data = response.json()
        
        if 'error' in token_data:
            flash(f'שגיאה בקבלת טוקן פייסבוק: {token_data["error"]["message"]}', 'error')
            return redirect(url_for('main.dashboard'))
        
        access_token = token_data['access_token']
        
        # אם אין משתמש מחובר, צריך להתחבר קודם עם Google
        if 'user_id' not in session:
            flash('יש להתחבר קודם עם Google', 'warning')
            return redirect(url_for('login'))
        
        user_id = session['user_id']
        
        # שמירת Facebook token
        save_facebook_token(user_id, access_token, token_data)
        
        flash('התחברת בהצלחה לפייסבוק Ads!', 'success')
        return redirect(url_for('dashboard'))
        
    except Exception as e:
        print(f"Facebook callback error: {e}")
        flash(f'שגיאה בהתחברות לפייסבוק: {str(e)}', 'error')
        return redirect(url_for('dashboard'))

def save_facebook_token(user_id, access_token, token_data):
    """שמירת Facebook token"""
    try:
        # מחיקת tokens קיימים
        FacebookToken.query.filter_by(user_id=user_id).delete()
        
        # חישוב תאריך תפוגה
        expires_at = None
        if 'expires_in' in token_data:
            expires_at = datetime.utcnow() + timedelta(seconds=int(token_data['expires_in']))
        
        facebook_token = FacebookToken(
            user_id=user_id,
            access_token=access_token,
            expires_at=expires_at
        )
        
        facebook_token.set_permissions(Config.FACEBOOK_PERMISSIONS)
        
        db.session.add(facebook_token)
        db.session.commit()
        
        print("✅ Facebook token saved successfully")
        
    except Exception as e:
        print(f"Error saving Facebook token: {e}")
        db.session.rollback()

def create_or_update_user(user_info, provider):
    """יצירת או עדכון משתמש"""
    try:
        if provider == 'google':
            user = User.query.filter_by(google_id=user_info['google_id']).first()
            if not user:
                user = User.query.filter_by(email=user_info['email']).first()
            
            if user:
                # עדכון משתמש קיים
                user.google_id = user_info['google_id']
                user.name = user_info['name']
            else:
                # יצירת משתמש חדש
                user = User(
                    email=user_info['email'],
                    name=user_info['name'],
                    google_id=user_info['google_id']
                )
                db.session.add(user)
        
        db.session.commit()
        return user
        
    except Exception as e:
        print(f"Error creating/updating user: {e}")
        db.session.rollback()
        return None

@auth_bp.route('/logout')
def logout():
    """יציאה מהמערכת"""
    session.clear()
    flash('התנתקת בהצלחה', 'info')
    return redirect(url_for('login'))

@auth_bp.route('/status')
def auth_status():
    """בדיקת סטטוס התחברות - לצורכי debug"""
    if 'user_id' not in session:
        return jsonify({'authenticated': False})
    
    user_id = session['user_id']
    
    # בדיקת Google tokens
    google_token = GoogleToken.query.filter_by(user_id=user_id).first()
    google_connected = google_token is not None and not google_token.is_expired()
    
    # בדיקת Facebook tokens
    facebook_token = FacebookToken.query.filter_by(user_id=user_id).first() 
    facebook_connected = facebook_token is not None and not facebook_token.is_expired()
    
    # קבלת חשבונות
    accounts = UserAccount.query.filter_by(user_id=user_id, is_active=True).all()
    
    return jsonify({
        'authenticated': True,
        'user_id': user_id,
        'user_email': session.get('user_email'),
        'user_name': session.get('user_name'),
        'google_connected': google_connected,
        'facebook_connected': facebook_connected,
        'accounts': [acc.to_dict() for acc in accounts]
    })