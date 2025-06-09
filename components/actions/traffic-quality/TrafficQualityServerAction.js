import TrafficQualityForm from './TrafficQualityForm';
import TrafficQualityClientResults from './TrafficQualityClientResults';

async function getInitialTrafficData(userId, propertyId, dateRange = '30days') {
    if (!propertyId) return null;

    // For initial server render, just return null and let client-side loading handle it
    // This avoids server-side fetch issues while maintaining SSR benefits
    return null;
}



export default async function TrafficQualityServerAction({ userId, initialData, searchParams = {} }) {
    const properties = initialData?.properties?.data || [];
    const selectedPropertyId = searchParams?.propertyId || (properties[0] ? properties[0].id || properties[0].name?.split('/').pop() : '');
    const dateRange = searchParams?.dateRange || '30days';

    // Pre-fetch traffic data if property is selected
    const trafficData = selectedPropertyId
        ? await getInitialTrafficData(userId, selectedPropertyId, dateRange)
        : initialData?.cachedData;

    return (
        <div className="action-container action-rtl">
            <div className="action-header">
                <h1 className="action-title">ניתוח איכות תנועה - Google Analytics</h1>
                <p className="action-description">
                    גלה מאיפה מגיעה התנועה הכי איכותית לאתר שלך וקבל המלצות לשיפור
                </p>
            </div>

            <TrafficQualityForm
                properties={properties}
                selectedPropertyId={selectedPropertyId}
                dateRange={dateRange}
                userId={userId}
            />

            <TrafficQualityClientResults
                selectedPropertyId={selectedPropertyId}
                dateRange={dateRange}
                userId={userId}
            />
        </div>
    );
} 