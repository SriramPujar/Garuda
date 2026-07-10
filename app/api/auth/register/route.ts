import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { username, password, securityQuestion, securityAnswer } = await req.json();

    if (!username || !password || !securityQuestion || !securityAnswer) {
      return NextResponse.json(
        { message: "Username, password, security question, and answer are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Username is already taken" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const securityAnswerHash = await bcrypt.hash(securityAnswer.trim().toLowerCase(), 10);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        securityQuestion,
        securityAnswer: securityAnswerHash,
      },
    });

    return NextResponse.json(
      { message: "User registered successfully", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
