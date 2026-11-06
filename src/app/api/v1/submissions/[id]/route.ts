import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import { getApiUser } from "@/lib/session";
import { getSubmissionDetail } from "@/lib/submissions";
import { parseUuidParam } from "@/lib/validation/params";

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
    const submissionId = parseUuidParam(id, "ID konten");
    const submission = await getSubmissionDetail(user, submissionId);
    return jsonOk(submission, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
