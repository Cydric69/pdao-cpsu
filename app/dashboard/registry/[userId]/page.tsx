import { getUserById } from "@/actions/registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { notFound } from "next/navigation";

export default async function UserDetailsPage({
  params,
}: {
  params: { userId: string };
}) {
  const result = await getUserById(params.userId);

  // Fixed: Check if result has data property before accessing it
  if (!result.success || !("data" in result) || !result.data) {
    notFound();
  }

  const user = result.data;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.avatar_url || undefined} />
          <AvatarFallback className="text-2xl">
            {user.first_name?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold">{user.full_name}</h1>
          <p className="text-muted-foreground">{user.user_id}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">First Name</p>
                <p className="font-medium">{user.first_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Middle Name</p>
                <p className="font-medium">{user.middle_name || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Name</p>
                <p className="font-medium">{user.last_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Suffix</p>
                <p className="font-medium">{user.suffix || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium">
                  {format(new Date(user.date_of_birth), "MMMM dd, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Age</p>
                <p className="font-medium">{user.age_display}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sex</p>
                <p className="font-medium">{user.sex}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contact Number</p>
              <p className="font-medium">{user.contact_number}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Street</p>
                <p className="font-medium">{user.address.street}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Barangay</p>
                <p className="font-medium">{user.address.barangay}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  City/Municipality
                </p>
                <p className="font-medium">{user.address.city_municipality}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Province</p>
                <p className="font-medium">{user.address.province}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Region</p>
                <p className="font-medium">{user.address.region}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Zip Code</p>
                <p className="font-medium">{user.address.zip_code || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge
                className={
                  user.status === "Active"
                    ? "bg-green-100 text-green-800"
                    : user.status === "Pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                }
              >
                {user.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Verification
              </span>
              <Badge
                className={
                  user.is_verified
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }
              >
                {user.is_verified ? "Verified" : "Unverified"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Email Verified
              </span>
              <Badge
                className={
                  user.is_email_verified
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }
              >
                {user.is_email_verified ? "Yes" : "No"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="font-medium">{user.role}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PWD Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">PWD Issued ID</p>
              <p className="font-medium">
                {user.pwd_issued_id || "Not issued"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Card ID</p>
              <p className="font-medium">{user.card_id || "Not assigned"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Form ID</p>
              <p className="font-medium">{user.form_id || "No form"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
