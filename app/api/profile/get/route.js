import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return Response.json({ error: "לא מורשה" }, { status: 401 });
        }

        const userId = session.user.id;

        // Get user profile
        const profile = await prisma.userProfile.findUnique({
            where: { userId }
        });

        if (!profile) {
            // Return default profile structure if not found
            return Response.json({
                profile: null,
                isOnboardingCompleted: false,
                isOnboardingSkipped: false,
                needsOnboarding: true
            });
        }

        return Response.json({
            profile,
            isOnboardingCompleted: profile.isOnboardingCompleted,
            isOnboardingSkipped: profile.isOnboardingSkipped,
            needsOnboarding: !profile.isOnboardingCompleted && !profile.isOnboardingSkipped,
            completedSteps: {
                step1: profile.step1Completed,
                step2: profile.step2Completed,
                step3: profile.step3Completed
            }
        });

    } catch (error) {
        console.error('Error getting profile:', error);
        return Response.json({
            error: "שגיאה בטעינת הפרופיל"
        }, { status: 500 });
    }
} 