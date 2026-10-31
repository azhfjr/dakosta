import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import { getApiUser } from "@/lib/session";
import { getSubmissionDetail } from "@/lib/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    const user = await getApiUser();
    const { id } = await params;
    const submission = await getSubmissionDetail(user, id);
    return jsonOk(submission, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
