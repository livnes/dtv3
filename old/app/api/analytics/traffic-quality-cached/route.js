export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check integration status
        const integration = await prisma.userIntegration.findFirst({
            where: {
                userId: session.user.id,
                provider: 'google'
            }
        });

        if (!integration) {
            return Response.json({
                error: 'No Google integration found'
            }, { status: 404 });
        }

        // If still importing, return status with progress
        if (integration.status === 'importing') {
            return Response.json({
                success: false,
                error: 'Data is being imported. Please wait a few minutes and try again.',
                status: 'importing',
                progress: {
                    started: integration.updatedAt,
                    estimated: '2-3 minutes remaining'
                }
            });
        }

        // Continue with normal data fetch...
        // ... existing traffic quality logic

    } catch (error) {
        // ... error handling
    }
} 