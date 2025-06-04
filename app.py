from flask import Flask, render_template, session, redirect, url_for, flash, request, jsonify
import os
from config import Config
from database import init_db, db, User, GoogleToken, FacebookToken, UserAccount
from auth import auth_bp

# Fix for development - allow HTTP for OAuth
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

def create_app():
    """יצירת Flask application"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize database
    init_db(app)
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    
    return app

app = create_app()

# Helper function לבדיקת authentication
def login_required(f):
    """Decorator לדרישה להתחברות"""
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('יש להתחבר כדי לגשת לדף זה', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Routes
@app.route('/')
def index():
    """עמוד בית"""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login')
def login():
    """עמוד התחברות"""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/dashboard')
@login_required
def dashboard():
    """דשבורד ראשי"""
    user_id = session['user_id']
    
    # קבלת פרטי משתמש
    user = User.query.get(user_id)
    if not user:
        session.clear()
        flash('שגיאה בקבלת פרטי משתמש', 'error')
        return redirect(url_for('login'))
    
    # בדיקת סטטוס התחברויות
    google_token = GoogleToken.query.filter_by(user_id=user_id).first()
    google_connected = google_token is not None and not google_token.is_expired()
    
    facebook_token = FacebookToken.query.filter_by(user_id=user_id).first()
    facebook_connected = facebook_token is not None and not facebook_token.is_expired()
    
    # קבלת חשבונות מחוברים
    accounts = UserAccount.query.filter_by(user_id=user_id, is_active=True).all()
    
    # סיווג חשבונות לפי סוג
    analytics_accounts = [acc for acc in accounts if acc.account_type == 'google_analytics']
    search_console_accounts = [acc for acc in accounts if acc.account_type == 'search_console']
    facebook_accounts = [acc for acc in accounts if acc.account_type == 'facebook_ads']
    
    return render_template('dashboard.html',
                         user=user,
                         google_connected=google_connected,
                         facebook_connected=facebook_connected,
                         analytics_accounts=analytics_accounts,
                         search_console_accounts=search_console_accounts,
                         facebook_accounts=facebook_accounts)

@app.route('/profile')
@login_required  
def profile():
    """עמוד פרופיל משתמש"""
    user_id = session['user_id']
    user = User.query.get(user_id)
    
    if not user:
        flash('משתמש לא נמצא', 'error')
        return redirect(url_for('login'))
    
    return render_template('profile.html', user=user)

@app.route('/accounts')
@login_required
def accounts():
    """עמוד ניהול חשבונות"""
    user_id = session['user_id']
    user = User.query.get(user_id)
    
    if not user:
        flash('משתמש לא נמצא', 'error')
        return redirect(url_for('login'))
    
    # קבלת כל החשבונות
    all_accounts = UserAccount.query.filter_by(user_id=user_id).all()
    
    # סיווג לפי סוג
    analytics_accounts = [acc for acc in all_accounts if acc.account_type == 'google_analytics']
    search_console_accounts = [acc for acc in all_accounts if acc.account_type == 'search_console']
    facebook_accounts = [acc for acc in all_accounts if acc.account_type == 'facebook_ads']
    
    # בדיקת סטטוס התחברות
    google_token = GoogleToken.query.filter_by(user_id=user_id).first()
    google_connected = google_token is not None and not google_token.is_expired()
    
    facebook_token = FacebookToken.query.filter_by(user_id=user_id).first()
    facebook_connected = facebook_token is not None and not facebook_token.is_expired()
    
    return render_template('accounts.html',
                         user=user,
                         analytics_accounts=analytics_accounts,
                         search_console_accounts=search_console_accounts,
                         facebook_accounts=facebook_accounts,
                         google_connected=google_connected,
                         facebook_connected=facebook_connected)

@app.route('/accounts/toggle/<int:account_id>')
@login_required
def toggle_account(account_id):
    """החלפת סטטוס חשבון (פעיל/לא פעיל)"""
    user_id = session['user_id']
    
    account = UserAccount.query.filter_by(id=account_id, user_id=user_id).first()
    if not account:
        flash('חשבון לא נמצא', 'error')
        return redirect(url_for('accounts'))
    
    # החלפת סטטוס
    account.is_active = not account.is_active
    db.session.commit()
    
    status = "הופעל" if account.is_active else "הושבת"
    flash(f'חשבון {account.account_name} {status} בהצלחה', 'success')
    
    return redirect(url_for('accounts'))

@app.route('/accounts/refresh')
@login_required
def refresh_accounts():
    """רענון רשימת החשבונות מGoogle"""
    user_id = session['user_id']
    
    # קבלת Google token
    google_token = GoogleToken.query.filter_by(user_id=user_id).first()
    if not google_token or google_token.is_expired():
        flash('יש להתחבר מחדש לGoogle', 'warning')
        return redirect(url_for('auth.google_login'))
    
    try:
        # יצירת credentials מהtoken השמור
        from google.oauth2.credentials import Credentials
        
        credentials = Credentials(
            token=google_token.access_token,
            refresh_token=google_token.refresh_token,
            token_uri=google_token.token_uri,
            client_id=google_token.client_id,
            client_secret=google_token.client_secret,
            scopes=google_token.get_scopes()
        )
        
        # רענון החשבונות
        from auth import fetch_google_accounts
        fetch_google_accounts(user_id, credentials)
        
        flash('רשימת החשבונות עודכנה בהצלחה', 'success')
        
    except Exception as e:
        print(f"Error refreshing accounts: {e}")
        flash('שגיאה ברענון החשבונות', 'error')
    
    return redirect(url_for('accounts'))

@app.route('/action/<action_id>')
@login_required
def action_page(action_id):
    """עמוד פעולה ספציפית"""
    user_id = session['user_id']
    user = User.query.get(user_id)
    
    if not user:
        flash('משתמש לא נמצא', 'error')
        return redirect(url_for('login'))
    
    # בדיקה שיש חשבונות פעילים
    active_accounts = UserAccount.query.filter_by(user_id=user_id, is_active=True).all()
    if not active_accounts:
        flash('יש לחבר חשבונות כדי לבצע ניתוחים', 'warning')
        return redirect(url_for('accounts'))
    
    # הגדרת הפעולות הזמינות
    actions = {
        'traffic-quality': {
            'title': 'מקורות תנועה איכותיים',
            'description': 'ניתוח מעמיק של מקורות התנועה שמביאים את המבקרים הכי איכותיים לאתר שלך',
            'explanation': 'תנועה איכותית נמדדת על פי: זמן שהייה באתר, שיעור נטישה נמוך, מספר דפים לביקור והמרות',
            'metrics': ['Sessions', 'Users', 'Bounce Rate', 'Session Duration', 'Pages per Session'],
            'service_type': 'analytics',
            'available': True
        },
        'search-keywords': {
            'title': 'מילות חיפוש מובילות',
            'description': 'גלה איזו מילת חיפוש מביאה לך הכי הרבה תנועה מגוגל ואיך לשפר את הדירוג',
            'explanation': 'ניתוח מבוסס על נתוני Search Console: קליקים, הצגות, CTR ודירוג ממוצע',
            'metrics': ['Clicks', 'Impressions', 'CTR', 'Average Position', 'Traffic Potential'],
            'service_type': 'search_console',
            'available': True
        }
    }
    
    if action_id not in actions:
        flash('פעולה לא נמצאה', 'error')
        return redirect(url_for('dashboard'))
    
    action = actions[action_id]
    
    if not action['available']:
        flash('פעולה זו עדיין לא זמינה', 'info')
        return redirect(url_for('dashboard'))
    
    return render_template('action.html', 
                         user=user, 
                         action=action, 
                         action_id=action_id,
                         active_accounts=active_accounts)

@app.route('/api/analyze', methods=['POST'])
@login_required
def analyze_data():
    """API endpoint לביצוע ניתוח נתונים"""
    try:
        data = request.get_json()
        user_id = session['user_id']
        
        # בדיקת פרמטרים
        action_id = data.get('action_id')
        if action_id not in ['traffic-quality', 'search-keywords']:
            return jsonify({'success': False, 'error': 'פעולה לא נתמכת'})
        
        # קבלת Google credentials
        google_token = GoogleToken.query.filter_by(user_id=user_id).first()
        if not google_token or google_token.is_expired():
            return jsonify({'success': False, 'error': 'יש להתחבר מחדש לGoogle'})
        
        # יצירת credentials
        from google.oauth2.credentials import Credentials
        credentials = Credentials(
            token=google_token.access_token,
            refresh_token=google_token.refresh_token,
            token_uri=google_token.token_uri,
            client_id=google_token.client_id,
            client_secret=google_token.client_secret,
            scopes=google_token.get_scopes()
        )
        
        date_range = data.get('dateRange', '30days')
        comparison = data.get('comparison', 'none')
        
        # Handle Analytics actions
        if action_id == 'traffic-quality':
            # קבלת חשבון Analytics
            account_id = data.get('analyticsAccount')
            account = UserAccount.query.filter_by(
                user_id=user_id, 
                account_id=account_id, 
                account_type='google_analytics',
                is_active=True
            ).first()
            
            if not account:
                return jsonify({'success': False, 'error': 'חשבון Analytics לא נמצא'})
            
            # יצירת Analytics service
            from analytics import AnalyticsService
            analytics_service = AnalyticsService(credentials)
            
            print(f"🔍 Analyzing traffic quality for property: {account_id}")
            
            # שליפת נתונים אמיתיים
            analytics_data = analytics_service.get_traffic_quality_data(
                property_id=account_id,
                date_range=date_range,
                comparison=comparison if comparison != 'none' else None
            )
            
            if not analytics_data['success']:
                return jsonify({
                    'success': False, 
                    'error': f'שגיאה בקבלת נתונים מ-Analytics: {analytics_data["error"]}'
                })
            
            traffic_sources = analytics_data['traffic_sources']
            total_sessions = analytics_data['total_sessions']
            
            # יצירת תובנות והמלצות
            ai_insights = analytics_service.generate_insights(traffic_sources, total_sessions)
            recommendations = analytics_service.generate_recommendations(traffic_sources)
            
            # החזרת תוצאות
            results = {
                'traffic_sources': traffic_sources,
                'ai_insights': f"""
                    <strong>תובנות מרכזיות מהניתוח של {total_sessions:,} ביקורים:</strong>
                    {ai_insights}
                """,
                'recommendations': f"""
                    <strong>המלצות לשיפור:</strong>
                    {recommendations}
                """,
                'date_range': analytics_data['date_range']
            }
            
            print(f"✅ Analytics analysis completed. Found {len(traffic_sources)} traffic sources")
            
        # Handle Search Console actions
        elif action_id == 'search-keywords':
            # קבלת חשבון Search Console
            search_account_id = data.get('searchAccount')
            if not search_account_id:
                # אם לא צוין, קח את הראשון הפעיל
                account = UserAccount.query.filter_by(
                    user_id=user_id,
                    account_type='search_console',
                    is_active=True
                ).first()
                if account:
                    search_account_id = account.account_id
            
            if not search_account_id:
                return jsonify({'success': False, 'error': 'חשבון Search Console לא נמצא'})
            
            # יצירת Search Console service
            from search_console import SearchConsoleService
            search_service = SearchConsoleService(credentials)
            
            print(f"🔍 Analyzing search keywords for site: {search_account_id}")
            
            # שליפת נתונים אמיתיים
            search_data = search_service.get_top_search_keywords(
                site_url=search_account_id,
                date_range=date_range,
                comparison=comparison if comparison != 'none' else None
            )
            
            if not search_data['success']:
                return jsonify({
                    'success': False, 
                    'error': f'שגיאה בקבלת נתונים מ-Search Console: {search_data["error"]}'
                })
            
            keywords = search_data['keywords']
            summary = search_data['summary']
            
            # יצירת תובנות והמלצות
            ai_insights = search_service.generate_insights(keywords, summary)
            recommendations = search_service.generate_recommendations(keywords, summary)
            
            # החזרת תוצאות
            results = {
                'keywords': keywords,
                'ai_insights': f"""
                    <strong>תובנות מרכזיות מניתוח {summary['total_keywords']} מילות חיפוש:</strong>
                    {ai_insights}
                """,
                'recommendations': f"""
                    <strong>המלצות SEO:</strong>
                    {recommendations}
                """,
                'summary': summary,
                'date_range': search_data['date_range']
            }
            
            print(f"✅ Search Console analysis completed. Found {len(keywords)} keywords")
        
        return jsonify({
            'success': True,
            'results': results
        })
        
    except Exception as e:
        print(f"❌ Error in analyze_data: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'success': False, 
            'error': f'שגיאה פנימית בשרת: {str(e)}'
        })

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return f"<h1>404 - דף לא נמצא</h1><a href='{url_for('index')}'>חזרה לעמוד הבית</a>", 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return f"<h1>500 - שגיאת שרת</h1><a href='{url_for('index')}'>חזרה לעמוד הבית</a>", 500

# Template helpers
@app.template_global()
def is_authenticated():
    """בדיקה אם המשתמש מחובר"""
    return 'user_id' in session

@app.template_global()
def current_user():
    """קבלת המשתמש הנוכחי"""
    if 'user_id' in session:
        return User.query.get(session['user_id'])
    return None

@app.template_filter('hebrew_date')
def hebrew_date_filter(date):
    """פורמט תאריך בעברית"""
    if not date:
        return ''
    
    months = {
        1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל',
        5: 'מאי', 6: 'יוני', 7: 'יולי', 8: 'אוגוסט',
        9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר'
    }
    
    return f"{date.day} {months[date.month]} {date.year}"

if __name__ == '__main__':
    print("🚀 Starting DTV3 Analytics Dashboard...")
    print("📊 Visit: http://localhost:8080")
    app.run(debug=True, host='0.0.0.0', port=8080)