import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET() {
  // Only allow in development environment
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seeding is only allowed in development" },
      { status: 403 },
    );
  }

  try {
    // Connect to database
    await connectToDatabase();
    console.log("📦 Connected to pdao database");

    const results = {
      users: [] as any[],
    };

    // ============ SEED USERS ============
    const usersData = [
      {
        first_name: "Pedro",
        middle_name: "Garcia",
        last_name: "Santos",
        suffix: "",
        sex: "Male",
        date_of_birth: "1985-06-15",
        email: "pedro.santos@gmail.com",
        password: "User123!",
        contact_number: "09181234567",
        address: {
          street: "Block 1 Lot 5",
          barangay: "San Isidro",
          city_municipality: "Las Piñas",
          province: "Metro Manila",
          region: "NCR",
          zip_code: "1740",
          country: "Philippines",
          type: "Permanent",
        },
        role: "User",
        status: "Active",
        is_verified: true,
        is_email_verified: true,
        avatar_url: null,
        created_by: null,
        updated_by: null,
      },
      // ... rest of your users
    ];

    for (const userData of usersData) {
      // Check if user already exists
      const existingUser = await UserModel.findOne({
        $or: [
          { email: userData.email },
          { contact_number: userData.contact_number },
        ],
      });

      if (!existingUser) {
        try {
          // Hash the password before saving
          const hashedPassword = await bcrypt.hash(userData.password, 10);

          const user = await UserModel.create({
            ...userData,
            password: hashedPassword, // Use hashed password
          });

          results.users.push({
            email: userData.email,
            contact_number: userData.contact_number,
            status: "created",
            user_id: user.user_id,
            role: user.role,
          });
        } catch (error: any) {
          results.users.push({
            email: userData.email,
            status: "failed",
            error: error.message,
          });
        }
      } else {
        results.users.push({
          email: userData.email,
          status: "already exists",
          user_id: existingUser.user_id,
          role: existingUser.role,
        });
      }
    }

    // Get total count
    const totalUsers = await UserModel.countDocuments();

    return NextResponse.json({
      message: "Users seeded successfully",
      database: "pdao",
      total_users: totalUsers,
      results,
    });
  } catch (error) {
    console.error("Error seeding users:", error);
    return NextResponse.json(
      {
        error: "Failed to seed users",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
