import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await getApiUser({ allowPasswordChangePending: true });

    return jsonOk(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        scope: user.scope,
        scopeLabel: user.scopeLabel,
        capabilities: user.capabilities,
        isDemo: user.isDemo,
        mustChangePassword: user.mustChangePassword,
        displayTitle: user.displayTitle,
        stakeholderIds: user.stakeholderIds,
        redirectTo: user.mustChangePassword ? "/ganti-password" : user.homePath,
      },
      { requestId },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
