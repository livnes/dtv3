import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return Response.json({ error: "לא מורשה" }, { status: 401 });
        }

        const userId = session.user.id;

        // Update or create user profile with skip flag
        const profile = await prisma.userProfile.upsert({
            where: { userId },
            update: {
                isOnboardingSkipped: true,
                updatedAt: new Date()
            },
            create: {
                userId,
                isOnboardingSkipped: true
            }
        });

        return Response.json({
            success: true,
            message: "הכשרה נדחתה בהצלחה",
            profile
        });

    } catch (error) {
        console.error('Error skipping onboarding:', error);
        return Response.json({
            error: "שגיאה בדחיית ההכשרה"
        }, { status: 500 });
    }
} 