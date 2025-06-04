from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timedelta
import json

class AnalyticsService:
    def __init__(self, credentials):
        """Initialize Analytics service with user credentials"""
        self.credentials = credentials
        # Google Analytics Data API v1 (GA4)
        self.analytics = build('analyticsdata', 'v1beta', credentials=credentials)
    
    def get_traffic_quality_data(self, property_id, date_range='30days', comparison=None):
        """
        Get traffic quality data from Google Analytics
        
        Args:
            property_id: GA4 Property ID (format: properties/123456789)
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
            
            # Format property ID correctly
            if not property_id.startswith('properties/'):
                property_id = f'properties/{property_id}'
            
            # Build the request
            request = {
                'property': property_id,
                'dateRanges': [
                    {
                        'startDate': start_date.strftime('%Y-%m-%d'),
                        'endDate': end_date.strftime('%Y-%m-%d')
                    }
                ],
                'dimensions': [
                    {'name': 'sessionDefaultChannelGrouping'},  # Traffic source grouping
                    {'name': 'sessionSourceMedium'}  # Detailed source/medium
                ],
                'metrics': [
                    {'name': 'sessions'},
                    {'name': 'totalUsers'},
                    {'name': 'bounceRate'},
                    {'name': 'averageSessionDuration'},
                    {'name': 'screenPageViewsPerSession'},
                    {'name': 'conversions'}  # If goals are set up
                ],
                'orderBys': [
                    {
                        'metric': {'metricName': 'sessions'},
                        'desc': True
                    }
                ],
                'limit': 10
            }
            
            print(f"🔍 Fetching Analytics data for property: {property_id}")
            print(f"📅 Date range: {start_date} to {end_date}")
            
            # Make the API call
            response = self.analytics.properties().runReport(
                property=property_id,
                body=request
            ).execute()
            
            print("✅ Analytics API call successful")
            
            # Process the response
            traffic_sources = []
            
            if 'rows' in response:
                for row in response['rows']:
                    # Extract dimension values
                    channel_group = row['dimensionValues'][0]['value']
                    source_medium = row['dimensionValues'][1]['value']
                    
                    # Extract metric values
                    metrics = row['metricValues']
                    sessions = int(metrics[0]['value'])
                    users = int(metrics[1]['value'])
                    bounce_rate = float(metrics[2]['value']) * 100  # Convert to percentage
                    avg_duration = float(metrics[3]['value'])  # In seconds
                    pages_per_session = float(metrics[4]['value'])
                    conversions = int(metrics[5]['value']) if len(metrics) > 5 else 0
                    
                    # Format session duration as MM:SS
                    duration_minutes = int(avg_duration // 60)
                    duration_seconds = int(avg_duration % 60)
                    duration_formatted = f"{duration_minutes}:{duration_seconds:02d}"
                    
                    # Calculate quality score
                    quality_score = self.calculate_quality_score(
                        avg_duration, bounce_rate, pages_per_session, conversions, sessions
                    )
                    
                    traffic_sources.append({
                        'source': channel_group,
                        'source_medium': source_medium,
                        'sessions': sessions,
                        'users': users,
                        'avg_session_duration': duration_formatted,
                        'avg_session_duration_seconds': avg_duration,
                        'bounce_rate': round(bounce_rate, 1),
                        'pages_per_session': round(pages_per_session, 1),
                        'conversions': conversions,
                        'quality_score': quality_score
                    })
            
            # Sort by quality score
            traffic_sources.sort(key=lambda x: x['quality_score'], reverse=True)
            
            return {
                'success': True,
                'traffic_sources': traffic_sources,
                'date_range': {
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d')
                },
                'total_sessions': sum(source['sessions'] for source in traffic_sources)
            }
            
        except Exception as e:
            print(f"❌ Error fetching Analytics data: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def calculate_quality_score(self, avg_duration, bounce_rate, pages_per_session, conversions, sessions):
        """
        Calculate traffic quality score based on multiple factors
        
        Score is 0-100 where:
        - Session duration (30%): longer is better
        - Bounce rate (30%): lower is better  
        - Pages per session (20%): more is better
        - Conversion rate (20%): higher is better
        """
        
        # Normalize session duration (max 600 seconds = 10 minutes)
        duration_score = min(avg_duration / 600, 1) * 100
        
        # Bounce rate score (inverse - lower bounce rate = higher score)
        bounce_score = max(0, 100 - bounce_rate)
        
        # Pages per session score (max 10 pages)
        pages_score = min(pages_per_session / 10, 1) * 100
        
        # Conversion rate score
        conversion_rate = (conversions / sessions * 100) if sessions > 0 else 0
        conversion_score = min(conversion_rate * 10, 100)  # 10% conversion = 100 score
        
        # Weighted average
        quality_score = (
            duration_score * 0.3 +
            bounce_score * 0.3 +
            pages_score * 0.2 +
            conversion_score * 0.2
        )
        
        return round(quality_score)
    
    def generate_insights(self, traffic_sources, total_sessions):
        """Generate AI-like insights from the data"""
        
        if not traffic_sources:
            return "לא נמצאו נתונים לניתוח"
        
        best_source = traffic_sources[0]
        worst_source = traffic_sources[-1]
        
        insights = []
        
        # Best performer insight
        insights.append(f"<strong>{best_source['source']}</strong> הוא מקור התנועה הכי איכותי שלך "
                       f"(ציון {best_source['quality_score']}) עם {best_source['sessions']:,} ביקורים")
        
        # Session duration insights
        if best_source['avg_session_duration_seconds'] > 180:  # 3 minutes
            insights.append(f"זמן השהייה הממוצע מ-{best_source['source']} מצוין "
                           f"({best_source['avg_session_duration']})")
        
        # Bounce rate insights
        if best_source['bounce_rate'] < 30:
            insights.append(f"שיעור הנטישה מ-{best_source['source']} נמוך מאוד "
                           f"({best_source['bounce_rate']}%) - זה מעולה!")
        
        # Volume vs Quality insight
        highest_volume = max(traffic_sources, key=lambda x: x['sessions'])
        if highest_volume != best_source:
            insights.append(f"<strong>{highest_volume['source']}</strong> מביא הכי הרבה תנועה "
                           f"({highest_volume['sessions']:,} ביקורים) אבל לא בהכרח הכי איכותית")
        
        # Improvement opportunity
        if len(traffic_sources) > 1 and worst_source['sessions'] > total_sessions * 0.1:
            insights.append(f"יש הזדמנות לשיפור ב-<strong>{worst_source['source']}</strong> - "
                           f"מביא הרבה תנועה ({worst_source['sessions']:,}) אבל עם איכות נמוכה יותר")
        
        return "<ul class='mb-0 mt-2'>" + "".join([f"<li>{insight}</li>" for insight in insights]) + "</ul>"
    
    def generate_recommendations(self, traffic_sources):
        """Generate actionable recommendations"""
        
        if not traffic_sources:
            return "אין מספיק נתונים להמלצות"
        
        recommendations = []
        best_source = traffic_sources[0]
        
        # Investment recommendation
        recommendations.append(f"<strong>הגדל השקעה ב-{best_source['source']}</strong> - "
                              f"זה המקור הכי איכותי שלך")
        
        # Find sources with high bounce rate
        high_bounce_sources = [s for s in traffic_sources if s['bounce_rate'] > 60]
        if high_bounce_sources:
            source_name = high_bounce_sources[0]['source']
            recommendations.append(f"<strong>שפר את חוויית המשתמש מ-{source_name}</strong> - "
                                  f"שיעור נטישה גבוה ({high_bounce_sources[0]['bounce_rate']}%)")
        
        # Find sources with low pages per session
        low_engagement = [s for s in traffic_sources if s['pages_per_session'] < 2]
        if low_engagement:
            source_name = low_engagement[0]['source']
            recommendations.append(f"<strong>שפר את התוכן עבור {source_name}</strong> - "
                                  f"מבקרים רואים מעט דפים ({low_engagement[0]['pages_per_session']})")
        
        # Conversion opportunity
        high_traffic_low_conversion = [s for s in traffic_sources 
                                     if s['sessions'] > 100 and s['conversions'] == 0]
        if high_traffic_low_conversion:
            source_name = high_traffic_low_conversion[0]['source']
            recommendations.append(f"<strong>הוסף מטרות המרה עבור {source_name}</strong> - "
                                  f"תנועה גבוהה ללא מעקב המרות")
        
        return "<ul class='mb-0 mt-2'>" + "".join([f"<li>{rec}</li>" for rec in recommendations]) + "</ul>"