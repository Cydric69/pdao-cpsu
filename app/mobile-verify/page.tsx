// app/mobile-verify/page.tsx
import { Suspense } from "react";
import { headers } from "next/headers";
import FaceVerificationMobile from "@/components/face/FaceVerificationMobile";

export const dynamic = "force-dynamic"; // Prevent static optimization

export default async function MobileVerifyPage() {
  // Await the headers promise
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";

  // Optional: Log for debugging
  const isFromReactNative =
    userAgent.includes("ReactNative") ||
    userAgent.includes("Expo") ||
    userAgent.includes("WebView");

  if (process.env.NODE_ENV === "development" && isFromReactNative) {
    console.log("📱 MobileVerifyPage accessed from React Native WebView");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-4">
        <div className="mb-4 text-center">
          <h1 className="text-xl font-bold text-gray-900">
            PWD ID Verification
          </h1>
          <p className="text-sm text-gray-600">Mobile-optimized verification</p>
        </div>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent"></div>
                <p className="mt-2 text-sm text-gray-600">
                  Loading verification system...
                </p>
              </div>
            </div>
          }
        >
          <FaceVerificationMobile />
        </Suspense>
      </div>
    </div>
  );
}
