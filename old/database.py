from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    google_id = db.Column(db.String(50), unique=True, nullable=True)
    facebook_id = db.Column(db.String(50), unique=True, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    google_tokens = db.relationship('GoogleToken', backref='user', lazy=True, cascade='all, delete-orphan')
    facebook_tokens = db.relationship('FacebookToken', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.email}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class GoogleToken(db.Model):
    __tablename__ = 'google_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    access_token = db.Column(db.Text, nullable=False)
    refresh_token = db.Column(db.Text, nullable=True)
    token_uri = db.Column(db.String(200), nullable=True)
    client_id = db.Column(db.String(200), nullable=True)
    client_secret = db.Column(db.Text, nullable=True)
    scopes = db.Column(db.Text, nullable=True)  # JSON string של scopes
    expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def set_scopes(self, scopes_list):
        """שמירת רשימת scopes כ-JSON"""
        self.scopes = json.dumps(scopes_list)
    
    def get_scopes(self):
        """קבלת רשימת scopes מ-JSON"""
        if self.scopes:
            return json.loads(self.scopes)
        return []
    
    def is_expired(self):
        """בדיקה אם הטוקן פג תוקף"""
        if not self.expires_at:
            return False
        return datetime.utcnow() >= self.expires_at

class FacebookToken(db.Model):
    __tablename__ = 'facebook_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    access_token = db.Column(db.Text, nullable=False)
    token_type = db.Column(db.String(20), default='Bearer')
    expires_at = db.Column(db.DateTime, nullable=True)
    permissions = db.Column(db.Text, nullable=True)  # JSON string של permissions
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def set_permissions(self, permissions_list):
        """שמירת רשימת permissions כ-JSON"""
        self.permissions = json.dumps(permissions_list)
    
    def get_permissions(self):
        """קבלת רשימת permissions מ-JSON"""
        if self.permissions:
            return json.loads(self.permissions)
        return []
    
    def is_expired(self):
        """בדיקה אם הטוקן פג תוקף"""
        if not self.expires_at:
            return False
        return datetime.utcnow() >= self.expires_at

class UserAccount(db.Model):
    __tablename__ = 'user_accounts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    account_type = db.Column(db.String(20), nullable=False)  # 'google_analytics', 'search_console', 'facebook_ads'
    account_id = db.Column(db.String(100), nullable=False)
    account_name = db.Column(db.String(200), nullable=False)
    website_url = db.Column(db.String(300), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    user = db.relationship('User', backref='accounts')
    
    def __repr__(self):
        return f'<UserAccount {self.account_type}: {self.account_name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'account_type': self.account_type,
            'account_id': self.account_id,
            'account_name': self.account_name,
            'website_url': self.website_url,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

def init_db(app):
    """Initialize database with app"""
    db.init_app(app)
    
    with app.app_context():
        # Create all tables
        db.create_all()
        print("✅ Database tables created successfully!")