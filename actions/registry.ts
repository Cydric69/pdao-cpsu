"use server";

import { UserModel } from "@/models/User";
import { connectToDatabase } from "@/lib/mongodb";

export type UserListItem = {
  _id: string;
  user_id: string;
  form_id: string | null;
  pwd_issued_id?: string | null;
  card_id?: string | null;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  sex: string;
  date_of_birth: Date;
  email: string;
  is_verified: boolean;
  status: string;
  created_at: Date;
};

export async function getUsers(): Promise<{
  success: boolean;
  data?: UserListItem[];
  error?: string;
}> {
  try {
    await connectToDatabase();

    const users = await UserModel.find({})
      .select({
        _id: 1,
        user_id: 1,
        form_id: 1,
        pwd_issued_id: 1,
        card_id: 1,
        first_name: 1,
        middle_name: 1,
        last_name: 1,
        suffix: 1,
        sex: 1,
        date_of_birth: 1,
        email: 1,
        is_verified: 1,
        status: 1,
        created_at: 1,
      })
      .sort({ created_at: -1 })
      .lean()
      .exec();

    const transformedUsers = users.map((user) => ({
      ...user,
      _id: user._id.toString(),
      date_of_birth: user.date_of_birth,
      created_at: user.created_at,
    }));

    return {
      success: true,
      data: transformedUsers as UserListItem[],
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch users",
    };
  }
}
