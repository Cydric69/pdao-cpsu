import {
  UserSchema,
  UserRegisterSchema,
  UserUpdateSchema,
  UserLoginSchema,
  UserPublicSchema,
  User,
  UserRegister,
  UserUpdate,
  UserLogin,
  UserPublic,
} from "@/types/user";

// ============ VALIDATION FUNCTIONS ============
export const validateUser = (data: unknown): User => {
  return UserSchema.parse(data);
};

export const validateUserRegister = (data: unknown): UserRegister => {
  return UserRegisterSchema.parse(data);
};

export const validateUserUpdate = (data: unknown): UserUpdate => {
  return UserUpdateSchema.parse(data);
};

export const validateUserLogin = (data: unknown): UserLogin => {
  return UserLoginSchema.parse(data);
};

// ============ TRANSFORMATION FUNCTIONS ============

/**
 * Sanitizes a user object for public consumption
 */
export const sanitizeUserForPublic = (user: any): UserPublic => {
  const userForZod = JSON.parse(JSON.stringify(user));

  if (userForZod.date_of_birth) {
    if (
      userForZod.date_of_birth instanceof Date ||
      (typeof userForZod.date_of_birth === "object" &&
        userForZod.date_of_birth.toISOString)
    ) {
      userForZod.date_of_birth = userForZod.date_of_birth
        .toISOString()
        .split("T")[0];
    }
  }

  if (userForZod.address) {
    userForZod.address = {
      street: userForZod.address.street || "",
      barangay: userForZod.address.barangay || "",
      city_municipality: userForZod.address.city_municipality || "",
      province: userForZod.address.province || "",
      region: userForZod.address.region || "",
      zip_code: userForZod.address.zip_code || "",
      country: userForZod.address.country || "Philippines",
      type: userForZod.address.type || "Permanent",
      coordinates: userForZod.address.coordinates || undefined,
    };
  }

  const publicUser = UserPublicSchema.parse(userForZod);

  let age = 0;
  if (user.date_of_birth) {
    const today = new Date();
    const birthDate = new Date(user.date_of_birth);
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
  }

  const fullName = `${user.first_name || ""} ${
    user.middle_name ? user.middle_name + " " : ""
  }${user.last_name || ""}${user.suffix ? " " + user.suffix : ""}`;

  return {
    ...publicUser,
    age_display: `${age} years`,
    full_name: fullName.trim(),
    is_pwd_verified: user.is_verified,
  };
};

/**
 * Transforms Zod-validated data to Mongoose-compatible format
 */
export const transformForMongoose = (data: any): any => {
  const transformed = { ...data };

  if (transformed.form_id) {
    delete transformed.form_id;
  }

  transformed.form_id = null;

  if (
    transformed.date_of_birth &&
    typeof transformed.date_of_birth === "string"
  ) {
    transformed.date_of_birth = new Date(transformed.date_of_birth);
  }

  if (transformed.contact_number) {
    let phone = transformed.contact_number.replace(/\D/g, "");
    if (phone.startsWith("63") && phone.length >= 12) {
      phone = "0" + phone.substring(2);
    }
    if (!phone.startsWith("0") && phone.length === 10) {
      phone = "0" + phone;
    }
    transformed.contact_number = phone.substring(0, 11);
  }

  return transformed;
};

// ============ HELPER FUNCTIONS ============

/**
 * Gets the full name from a user object
 */
export const getFullName = (user: any): string => {
  const parts = [
    user.first_name,
    user.middle_name,
    user.last_name,
    user.suffix,
  ].filter(Boolean);
  return parts.join(" ") || "User";
};

/**
 * Gets the display name from a user object
 */
export const getDisplayName = (user: any): string => {
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  return user.first_name || user.email?.split("@")[0] || "User";
};

/**
 * Gets the user's initial for avatar
 */
export const getUserInitial = (user: any): string => {
  return user.first_name ? user.first_name.charAt(0).toUpperCase() : "U";
};

/**
 * Formats PWD issued ID for display
 */
export const formatPWDId = (pwdId: string | null | undefined): string => {
  if (!pwdId) return "—";
  return pwdId;
};

/**
 * Formats card ID for display
 */
export const formatCardId = (cardId: string | null | undefined): string => {
  if (!cardId) return "—";
  return cardId;
};
