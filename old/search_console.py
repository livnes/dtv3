from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timedelta
import json

class SearchConsoleService:
    def __init__(self, credentials):
        """Initialize Search Console service with user credentials"""
        self.credentials = credentials
        # Google Search Console API
        self.search_console = build('searchconsole', 'v1', credentials=credentials)
    
    def get_top_search_keywords(self, site_url, date_range='30days', comparison=None):
        """
        Get top search keywords data from Google Search Console
        
        Args:
            site_url: Site URL (format: https://example.com/)
            date_range: '7days', '30days', '90days', or custom
            comparison: 'previous', 'year', or None
        """
        try:
            # Build date range
            end_date = datetime.now().date()
            
            if date_range == '7days':
                start_date = end_date - timedelta(days=7)
            elif date_range == '30days':
                start_date = end_date - timedelta(days=30)
            elif date_range == '90days':
                start_date = end_date - timedelta(days=90)
            else:
                start_date = end_date - timedelta(days=30)  # default
            
            # Build the request
            request = {
                'startDate': start_date.strftime('%Y-%m-%d'),
                'endDate': end_date.strftime('%Y-%m-%d'),
                'dimensions': ['query'],  # Search keywords
                'rowLimit': 20,  # Top 20 keywords
                'startRow': 0
            }
            
            print(f"🔍 Fetching Search Console data for site: {site_url}")
            print(f"📅 Date range: {start_date} to {end_date}")
            
            # Make the API call
            response = self.search_console.searchanalytics().query(
                siteUrl=site_url,
                body=request
            ).execute()
            
            print("✅ Search Console API call successful")
            
            # Process the response
            keywords_data = []
            total_clicks = 0
            total_impressions = 0
            
            if 'rows' in response:
                for row in response['rows']:
                    keyword = row['keys'][0]  # The search query
                    clicks = row['clicks']
                    impressions = row['impressions']
                    ctr = row['ctr'] * 100  # Convert to percentage
                    position = row['position']
                    
                    total_clicks += clicks
                    total_impressions += impressions
                    
                    # Calculate keyword quality score
                    quality_score = self.calculate_keyword_quality_score(
                        clicks, impressions, ctr, position
                    )
                    
                    keywords_data.append({
                        'keyword': keyword,
                        'clicks': clicks,
                        'impressions': impressions,
                        'ctr': round(ctr, 2),
                        'position': round(position, 1),
                        'quality_score': quality_score,
                        'traffic_potential': self.calculate_traffic_potential(impressions, position, ctr)
                    })
            
            # Sort by clicks (traffic volume)
            keywords_data.sort(key=lambda x: x['clicks'], reverse=True)
            
            return {
                'success': True,
                'keywords': keywords_data,
                'date_range': {
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d')
                },
                'summary': {
                    'total_clicks': total_clicks,
                    'total_impressions': total_impressions,
                    'average_ctr': round((total_clicks / total_impressions * 100) if total_impressions > 0 else 0, 2),
                    'total_keywords': len(keywords_data)
                }
            }
            
        except Exception as e:
            print(f"❌ Error fetching Search Console data: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def calculate_keyword_quality_score(self, clicks, impressions, ctr, position):
        """
        Calculate keyword quality score based on multiple factors
        
        Score is 0-100 where:
        - CTR (40%): higher is better
        - Position (30%): lower (better rank) is better  
        - Click volume (20%): more clicks is better
        - Impression volume (10%): more impressions is better
        """
        
        # CTR score (max 20% CTR = 100 score)
        ctr_score = min(ctr * 5, 100)
        
        # Position score (position 1 = 100, position 10 = 10, etc.)
        position_score = max(0, 110 - (position * 10))
        
        # Click volume score (logarithmic scale, 1000 clicks = 100)
        click_score = min((clicks / 1000) * 100, 100) if clicks > 0 else 0
        
        # Impression volume score (logarithmic scale, 10000 impressions = 100)
        impression_score = min((impressions / 10000) * 100, 100) if impressions > 0 else 0
        
        # Weighted average
        quality_score = (
            ctr_score * 0.4 +
            position_score * 0.3 +
            click_score * 0.2 +
            impression_score * 0.1
        )
        
        return round(quality_score)
    
    def calculate_traffic_potential(self, impressions, position, current_ctr):
        """Calculate potential traffic if keyword was optimized"""
        
        # Estimate CTR for position 1-3 based on industry averages
        potential_ctr = 25.0  # 25% CTR for top 3 positions
        
        if position <= 3:
            return "מיצוי מלא"
        else:
            potential_clicks = impressions * (potential_ctr / 100)
            current_clicks = impressions * (current_ctr / 100)
            additional_potential = max(0, potential_clicks - current_clicks)
            
            if additional_potential < 10:
                return "פוטנציאל נמוך"
            elif additional_potential < 100:
                return f"פוטנציאל בינוני (+{int(additional_potential)})"
            else:
                return f"פוטנציאל גבוה (+{int(additional_potential)})"
    
    def generate_insights(self, keywords_data, summary):
        """Generate AI-like insights from the keywords data"""
        
        if not keywords_data:
            return "לא נמצאו נתונים לניתוח"
        
        insights = []
        top_keyword = keywords_data[0]
        
        # Top performer insight
        insights.append(f"<strong>'{top_keyword['keyword']}'</strong> היא מילת החיפוש שמביאה הכי הרבה תנועה "
                       f"({top_keyword['clicks']:,} קליקים)")
        
        # Position insights
        if top_keyword['position'] <= 3:
            insights.append(f"האתר שלך מדורג במקום {top_keyword['position']:.1f} עבור המילה הזו - מעולה!")
        elif top_keyword['position'] <= 10:
            insights.append(f"האתר שלך מדורג במקום {top_keyword['position']:.1f} עבור המילה הזו - "
                           f"יש מקום לשיפור")
        else:
            insights.append(f"האתר שלך מדורג במקום {top_keyword['position']:.1f} עבור המילה הזו - "
                           f"צריך אופטימיזציה")
        
        # CTR insights
        high_ctr_keywords = [k for k in keywords_data if k['ctr'] > 5]
        if high_ctr_keywords:
            insights.append(f"יש לך {len(high_ctr_keywords)} מילות חיפוש עם CTR גבוה (מעל 5%) - "
                           f"זה מצוין!")
        
        # Low hanging fruit
        high_impressions_low_position = [k for k in keywords_data 
                                       if k['impressions'] > 1000 and k['position'] > 10]
        if high_impressions_low_position:
            insights.append(f"יש {len(high_impressions_low_position)} מילות חיפוש עם הרבה impressions "
                           f"אבל דירוג נמוך - הזדמנות זהב לשיפור!")
        
        # Overall performance
        total_clicks = summary['total_clicks']
        total_impressions = summary['total_impressions']
        if total_clicks > 0:
            insights.append(f"סך הכל קיבלת {total_clicks:,} קליקים מ-{total_impressions:,} הצגות "
                           f"(CTR ממוצע: {summary['average_ctr']}%)")
        
        return "<ul class='mb-0 mt-2'>" + "".join([f"<li>{insight}</li>" for insight in insights]) + "</ul>"
    
    def generate_recommendations(self, keywords_data, summary):
        """Generate actionable SEO recommendations"""
        
        if not keywords_data:
            return "אין מספיק נתונים להמלצות"
        
        recommendations = []
        
        # Focus on top performer
        top_keyword = keywords_data[0]
        recommendations.append(f"<strong>המשך לחזק את התוכן עבור '{top_keyword['keyword']}'</strong> - "
                              f"זו מילת החיפוש הכי מניבה שלך")
        
        # Low hanging fruit opportunities
        opportunities = [k for k in keywords_data 
                        if k['impressions'] > 500 and k['position'] > 5 and k['position'] <= 20]
        if opportunities:
            keyword = opportunities[0]['keyword']
            recommendations.append(f"<strong>שפר דירוג עבור '{keyword}'</strong> - "
                                  f"מקום {opportunities[0]['position']:.1f} עם הרבה פוטנציאל")
        
        # CTR optimization
        low_ctr_keywords = [k for k in keywords_data 
                           if k['impressions'] > 1000 and k['ctr'] < 2]
        if low_ctr_keywords:
            keyword = low_ctr_keywords[0]['keyword']
            recommendations.append(f"<strong>שפר את הTitle וMeta Description עבור '{keyword}'</strong> - "
                                  f"CTR נמוך ({low_ctr_keywords[0]['ctr']}%) למרות הרבה הצגות")
        
        # Position improvement
        positions_4_to_10 = [k for k in keywords_data if k['position'] >= 4 and k['position'] <= 10]
        if positions_4_to_10:
            keyword = positions_4_to_10[0]['keyword']
            recommendations.append(f"<strong>דחף את '{keyword}' לעמוד הראשון</strong> - "
                                  f"כרגע במקום {positions_4_to_10[0]['position']:.1f}")
        
        # Content gap analysis
        if len(keywords_data) < 50:
            recommendations.append(f"<strong>הרחב את היקף מילות החיפוש</strong> - "
                                  f"יש לך רק {len(keywords_data)} מילות חיפוש פעילות")
        
        return "<ul class='mb-0 mt-2'>" + "".join([f"<li>{rec}</li>" for rec in recommendations]) + "</ul>"