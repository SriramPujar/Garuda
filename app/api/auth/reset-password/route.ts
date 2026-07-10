import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { username, securityAnswer, newPassword } = await req.json();

    if (!username || !securityAnswer || !newPassword) {
      return NextResponse.json(
        { message: "All fields are required (username, security answer, and new password)" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { message: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Handle legacy users who do not have security answers set up yet
    if (!user.securityAnswer) {
      return NextResponse.json(
        { message: "Security answer has not been set up for this user. Please contact administrator." },
        { status: 400 }
      );
    }

    const isAnswerCorrect = await bcrypt.compare(
      securityAnswer.trim().toLowerCase(),
      user.securityAnswer
    );

    if (!isAnswerCorrect) {
      return NextResponse.json(
        { message: "Incorrect answer to security question" },
        { status: 401 }
      );
    }

    // Set new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    return NextResponse.json(
      { message: "Password reset successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
