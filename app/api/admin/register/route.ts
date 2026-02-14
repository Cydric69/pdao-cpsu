import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models/User";

export async function GET() {
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
      {
        first_name: "Maria",
        middle_name: "Luna",
        last_name: "Fernandez",
        suffix: "",
        sex: "Female",
        date_of_birth: "1990-11-23",
        email: "maria.fernandez@gmail.com",
        password: "User456!",
        contact_number: "09192345678",
        address: {
          street: "22A Mabini Street",
          barangay: "Poblacion",
          city_municipality: "Bacoor",
          province: "Cavite",
          region: "CALABARZON",
          zip_code: "4102",
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
      {
        first_name: "Jose",
        middle_name: "Rizal",
        last_name: "Mercado",
        suffix: "Jr.",
        sex: "Male",
        date_of_birth: "1978-03-28",
        email: "jose.mercado@yahoo.com",
        password: "User789!",
        contact_number: "09203456789",
        pwd_issued_id: "01-2023-001-1234567",
        card_id: "CARD-001234",
        address: {
          street: "15 Rizal Avenue",
          barangay: "San Jose",
          city_municipality: "Calamba",
          province: "Laguna",
          region: "CALABARZON",
          zip_code: "4027",
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
      {
        first_name: "Ana",
        middle_name: "Marie",
        last_name: "Villanueva",
        suffix: "",
        sex: "Female",
        date_of_birth: "1995-09-08",
        email: "ana.villanueva@gmail.com",
        password: "User101!",
        contact_number: "09314567890",
        address: {
          street: "78 San Francisco Street",
          barangay: "Sto. Niño",
          city_municipality: "Quezon City",
          province: "Metro Manila",
          region: "NCR",
          zip_code: "1100",
          country: "Philippines",
          type: "Permanent",
        },
        role: "Staff",
        status: "Active",
        is_verified: true,
        is_email_verified: true,
        avatar_url: null,
        created_by: null,
        updated_by: null,
      },
      {
        first_name: "Miguel",
        middle_name: "Dela",
        last_name: "Cruz",
        suffix: "",
        sex: "Male",
        date_of_birth: "1988-12-10",
        email: "miguel.cruz@gmail.com",
        password: "User202!",
        contact_number: "09425678901",
        address: {
          street: "56 Rizal Street",
          barangay: "Poblacion",
          city_municipality: "Batangas City",
          province: "Batangas",
          region: "CALABARZON",
          zip_code: "4200",
          country: "Philippines",
          type: "Permanent",
        },
        role: "User",
        status: "Pending",
        is_verified: false,
        is_email_verified: false,
        avatar_url: null,
        created_by: null,
        updated_by: null,
      },
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
          const user = await UserModel.create(userData);
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
