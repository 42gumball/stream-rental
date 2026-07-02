import "server-only";
import { prisma } from "@/lib/db";

type GoogleProfile = {
  googleId: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

// Find a user by Google id, else by email (linking an existing email account to
// Google), else create a new one.
export async function findOrCreateGoogleUser(profile: GoogleProfile) {
  const email = profile.email.toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { OR: [{ googleId: profile.googleId }, { email }] },
  });

  if (existing) {
    // Backfill googleId / avatar / name if this is the first Google sign-in.
    const needsUpdate =
      !existing.googleId || (!existing.image && !!profile.image) || (!existing.name && !!profile.name);
    if (!needsUpdate) return existing;
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        googleId: existing.googleId ?? profile.googleId,
        image: existing.image ?? profile.image ?? null,
        name: existing.name ?? profile.name ?? null,
      },
    });
  }

  return prisma.user.create({
    data: { email, googleId: profile.googleId, name: profile.name ?? null, image: profile.image ?? null },
  });
}
