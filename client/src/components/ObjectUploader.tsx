/**
 * @file ObjectUploader — File upload component backed by presigned URLs and
 * the Uppy upload library.
 *
 * Upload flow:
 *   1. User clicks the trigger button → Uppy DashboardModal opens.
 *   2. User selects file(s) in the modal and clicks "Upload".
 *   3. For each file, Uppy calls `onGetUploadParameters` which should request
 *      a presigned PUT URL from the backend (e.g. via the object storage
 *      integration route). The backend returns a signed GCS/S3 URL.
 *   4. Uppy PUTs the file directly to that presigned URL — the file goes
 *      straight from the browser to cloud storage, bypassing the app server.
 *   5. Once all uploads finish, `onComplete` fires so the caller can update
 *      server-side state (e.g. set ACL, store the object path in the DB).
 *
 * The component renders as a plain `<Button>` whose content is controlled
 * via `children`. The Uppy dashboard modal handles file selection, preview,
 * drag-and-drop, and progress indication.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import type { UppyFile, UploadResult } from "@uppy/core";
import DashboardModal from "@uppy/react/dashboard-modal";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import AwsS3 from "@uppy/aws-s3";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  /**
   * Function to get upload parameters for each file.
   * IMPORTANT: This receives the file object - use file.name, file.size, file.type
   * to request per-file presigned URLs from your backend.
   */
  onGetUploadParameters: (
    file: UppyFile<Record<string, unknown>, Record<string, unknown>>
  ) => Promise<{
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A file upload component that renders as a button and provides a modal interface for
 * file management.
 *
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - Provides a modal interface for:
 *   - File selection
 *   - File preview
 *   - Upload progress tracking
 *   - Upload status display
 *
 * The component uses Uppy v5 under the hood to handle all file upload functionality.
 * All file management features are automatically handled by the Uppy dashboard modal.
 *
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed to be uploaded
 *   (default: 1)
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.onGetUploadParameters - Function to get upload parameters for each file.
 *   Receives the UppyFile object with file.name, file.size, file.type properties.
 *   Use these to request per-file presigned URLs from your backend. Returns method,
 *   url, and optional headers for the upload request.
 * @param props.onComplete - Callback function called when upload is complete. Typically
 *   used to make post-upload API calls to update server state and set object ACL
 *   policies.
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);

  // Initialise the Uppy instance once via lazy-init state. The AwsS3
  // plugin handles presigned-URL uploads: for each file it calls
  // `onGetUploadParameters` to obtain a signed PUT URL from the backend,
  // then streams the file directly to cloud storage (GCS / S3).
  // `shouldUseMultipart: false` forces simple PUT uploads instead of
  // multipart, which matches the single-part presigned URLs the backend
  // generates. `autoProceed: false` lets the user review files before
  // uploading.
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: onGetUploadParameters,
      })
      .on("complete", (result) => {
        onComplete?.(result);
      })
  );

  return (
    <div>
      <Button onClick={() => setShowModal(true)} className={buttonClassName}>
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  );
}

