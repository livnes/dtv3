#!/bin/bash

# DTV3 Quick Start Script

echo "🚀 Starting DTV3 - Data Talk v3..."
echo "📊 AI-Powered Analytics Dashboard"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if requirements are installed
if [ ! -f "venv/installed" ]; then
    echo "📥 Installing dependencies..."
    pip install -r requirements.txt
    touch venv/installed
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Creating .env from template..."
    cp .env.example .env
    echo ""
    echo "🔑 Please edit .env file with your credentials:"
    echo "   - GOOGLE_CLIENT_ID"
    echo "   - GOOGLE_CLIENT_SECRET" 
    echo "   - FACEBOOK_APP_ID"
    echo "   - FACEBOOK_APP_SECRET"
    echo ""
    echo "💡 Generate SECRET_KEY with:"
    echo "   python3 -c \"import secrets; print(secrets.token_hex(32))\""
    echo ""
    read -p "Press Enter after updating .env file..."
fi

# Check if database exists
if [ ! -f "dtv3.db" ]; then
    echo "🗄️  Database will be created on first run..."
fi

echo ""
echo "🌟 Starting Flask application..."
echo "📍 Access at: http://localhost:8080"
echo "🛑 Press Ctrl+C to stop"
echo ""

# Run the application
python app.py