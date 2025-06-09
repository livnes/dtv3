import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return Response.json({ error: "לא מורשה" }, { status: 401 });
        }

        const body = await request.json();
        const { step, data } = body;

        if (!step || !data) {
            return Response.json({ error: "שלב ונתונים נדרשים" }, { status: 400 });
        }

        const userId = session.user.id;

        // Find or create user profile
        let profile = await prisma.userProfile.findUnique({
            where: { userId }
        });

        if (!profile) {
            profile = await prisma.userProfile.create({
                data: { userId }
            });
        }

        // Update profile based on step
        let updateData = {};

        if (step === 1) {
            updateData = {
                fullName: data.fullName,
                phoneNumber: data.phoneNumber,
                businessEmail: data.businessEmail,
                businessName: data.businessName,
                websiteUrl: data.websiteUrl,
                facebookUrl: data.facebookUrl,
                instagramUrl: data.instagramUrl,
                linkedinUrl: data.linkedinUrl,
                tiktokUrl: data.tiktokUrl,
                step1Completed: true
            };
        } else if (step === 2) {
            updateData = {
                dataGoals: data.dataGoals || [],
                mainMarketingObjective: data.mainMarketingObjective,
                businessAge: data.businessAge,
                marketingPlatforms: data.marketingPlatforms || [],
                marketingKnowledgeLevel: data.marketingKnowledgeLevel,
                step2Completed: true
            };
        } else if (step === 3) {
            updateData = {
                currentDataSources: data.currentDataSources || [],
                crmSystem: data.crmSystem,
                step3Completed: true
            };

            // Check if all steps are completed
            if (profile.step1Completed && profile.step2Completed) {
                updateData.isOnboardingCompleted = true;
                updateData.completedAt = new Date();
            }
        }

        // Update the profile
        const updatedProfile = await prisma.userProfile.update({
            where: { userId },
            data: updateData
        });

        return Response.json({
            success: true,
            profile: updatedProfile,
            message: step === 3 && updatedProfile.isOnboardingCompleted
                ? "שאלון ההכרות הושלם בהצלחה!"
                : `שלב ${step} נשמר בהצלחה`
        });

    } catch (error) {
        console.error('Error saving profile:', error);
        return Response.json({
            error: "שגיאה בשמירת הפרופיל"
        }, { status: 500 });
    }
} 