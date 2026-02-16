"use client";

import type { ChangeEvent, ClipboardEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import { API_BASE_URL, apiFetch, getRooms } from "@/lib/api";
import type { Room, RoomImage } from "@/lib/types";
import { getPublicStorageUrl } from "@/lib/supabaseStorageUrl";

type UploadStatus = "idle" | "uploading" | "success" | "error";
type ImportStatus = "idle" | "importing" | "success" | "error";
type PendingAction = "upload" | "import" | null;

const MAX_IMAGES = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function createPreviewUrls(files: File[]) {
  return files.map((file) => ({
    file,
    url: URL.createObjectURL(file),
  }));
}

function isValidImageFile(file: File) {
  return ALLOWED_TYPES.includes(file.type);
}

function parseUrls(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(lines));
  return unique.filter((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  });
}

function reorderList<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function getSlotFromImage(path: string, sortOrder?: number) {
  const match = path.match(/\/(\d{2})\.webp$/);
  if (match) {
    const slot = Number(match[1]);
    if (Number.isFinite(slot)) {
      return slot;
    }
  }
  if (sortOrder && sortOrder >= 1 && sortOrder <= MAX_IMAGES) {
    return sortOrder;
  }
  return null;
}

export default function AdminRoomImagesPage() {
  const params = useParams();
  const roomId = Number(params.id);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [importResults, setImportResults] = useState<
    Array<{ url: string; status: string; error?: string; index?: number }>
  >([]);
  const [uploadedRoom, setUploadedRoom] = useState<Room | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [requiredReplaceSlotsCount, setRequiredReplaceSlotsCount] = useState(0);
  const [selectedReplaceSlots, setSelectedReplaceSlots] = useState<number[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [replaceWarning, setReplaceWarning] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [pendingUrls, setPendingUrls] = useState<string[] | null>(null);
  const [activeReplaceSlot, setActiveReplaceSlot] = useState<number | null>(null);
  const [orderedImages, setOrderedImages] = useState<RoomImage[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  const { data: me, isLoading: isLoadingMe } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ user: { username: string; role: string } }>("/api/me"),
    retry: false,
  });

  const { data: rooms } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: getRooms,
    enabled: Number.isFinite(roomId),
  });

  const room = useMemo(
    () => rooms?.find((item) => item.id === roomId),
    [rooms, roomId]
  );

  const displayRoom = uploadedRoom ?? room;

  const previews = useMemo(() => createPreviewUrls(files), [files]);
  useEffect(() => {
    const images = displayRoom?.images ?? [];
    const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
    setOrderedImages(sorted);
  }, [displayRoom]);

  const applyRoomUpdate = (nextRoom: Room | null | undefined) => {
    setUploadedRoom(nextRoom ?? null);
    const images = nextRoom?.images ?? [];
    const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
    setOrderedImages(sorted);
  };

  const parsedUrls = useMemo(() => parseUrls(urlInput), [urlInput]);
  const canImportUrls =
    parsedUrls.length > 0 && parsedUrls.length <= MAX_IMAGES;
  const canUploadFiles = files.length > 0 && files.length <= MAX_IMAGES;
  const shouldSelectReplaceSlots =
    requiredReplaceSlotsCount > 1 && pendingAction;
  const canReorder =
    !shouldSelectReplaceSlots && orderedImages.length > 1 && !isReordering;

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    setRequiredReplaceSlotsCount(0);
    setSelectedReplaceSlots([]);
    setPendingAction(null);
    setReplaceWarning(null);
    setPendingFiles(null);
    setPendingUrls(null);
    setActiveReplaceSlot(null);
  }, [files, urlInput]);

  const addFiles = (incoming: File[]) => {
    const filtered = incoming.filter(isValidImageFile);
    if (filtered.length !== incoming.length) {
      setErrorMessage("Only JPG, PNG, or WEBP images are allowed.");
    }
    const next = [...files];
    for (const file of filtered) {
      if (next.length >= MAX_IMAGES) break;
      next.push(file);
    }
    if (next.length > MAX_IMAGES) {
      setErrorMessage("Max 5 images allowed.");
    } else if (incoming.length + files.length > MAX_IMAGES) {
      setErrorMessage("Only 5 images can be uploaded.");
    } else {
      setErrorMessage(null);
    }
    setFiles(next);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list) return;
    const incoming = Array.from(list);
    if (incoming.length + files.length > MAX_IMAGES) {
      setErrorMessage("Only 5 images can be uploaded.");
    }
    addFiles(incoming.slice(0, MAX_IMAGES - files.length));
    event.target.value = "";
  };

  const handlePaste = async (event: ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.clipboardData.items);
    const images = items
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (images.length === 0) {
      return;
    }

    addFiles(images);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(event.dataTransfer.files ?? []);
    if (dropped.length === 0) return;
    addFiles(dropped);
  };

  const handleRemove = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
    setErrorMessage(null);
  };

  const sendUploadRequest = async (filesToUpload: File[], replaceSlots?: number[]) => {
    const formData = new FormData();
    filesToUpload.forEach((file) => {
      formData.append("images", file);
    });
    const query = replaceSlots && replaceSlots.length > 0
      ? `?replaceSlots=${replaceSlots.join(",")}`
      : "";
    const response = await fetch(
      `${API_BASE_URL}/api/rooms/${roomId}/images/upload${query}`,
      {
        method: "POST",
        body: formData,
        credentials: "include",
      }
    );
    const data = (await response.json()) as {
      room?: Room;
      message?: string;
      existingSlots?: number[];
      freeSlots?: number[];
      requiredReplaceSlotsCount?: number;
    };
    return { response, data };
  };

  const handleUploadWithFiles = async (
    filesToUpload: File[],
    replaceSlots?: number[]
  ) => {
    if (!Number.isFinite(roomId)) {
      setErrorMessage("Invalid room id.");
      return;
    }
    if (filesToUpload.length < 1 || filesToUpload.length > MAX_IMAGES) {
      setErrorMessage("Please select between 1 and 5 images.");
      return;
    }

    setStatus("uploading");
    setErrorMessage(null);
    setPendingAction(null);

    try {
      const { response, data } = await sendUploadRequest(filesToUpload, replaceSlots);

      if (response.status === 409) {
        setRequiredReplaceSlotsCount(data.requiredReplaceSlotsCount ?? 0);
        if ((data.requiredReplaceSlotsCount ?? 0) > 1) {
          setPendingAction("upload");
          setReplaceWarning(null);
        } else {
          setPendingAction(null);
          setReplaceWarning("Use the Replace button on an image to swap a single slot.");
        }
        setPendingFiles([...filesToUpload]);
        setStatus("error");
        setErrorMessage(data.message ?? "Gallery full. Select slots to replace.");
        return;
      }

      if (!response.ok) {
        throw new Error(data?.message ?? "Upload failed");
      }

      applyRoomUpdate(data.room ?? null);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setStatus("success");
      setRequiredReplaceSlotsCount(0);
      setSelectedReplaceSlots([]);
      setReplaceWarning(null);
      setPendingFiles(null);
    } catch (error) {
      console.error("Room image upload failed:", error);
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Upload failed"
      );
    }
  };

  const sendImportRequest = async (urls: string[], replaceSlots?: number[]) => {
    const query = replaceSlots && replaceSlots.length > 0
      ? `?replaceSlots=${replaceSlots.join(",")}`
      : "";
    const response = await fetch(
      `${API_BASE_URL}/api/rooms/${roomId}/images/import-url${query}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ urls }),
      }
    );
    const data = (await response.json()) as {
      room?: Room;
      results?: Array<{ url: string; status: string; error?: string; index?: number }>;
      message?: string;
      existingSlots?: number[];
      freeSlots?: number[];
      requiredReplaceSlotsCount?: number;
    };
    return { response, data };
  };

  const handleImportUrlsWithUrls = async (
    urls: string[],
    replaceSlots?: number[]
  ) => {
    if (!Number.isFinite(roomId)) {
      setImportError("Invalid room id.");
      return;
    }
    if (urls.length < 1 || urls.length > MAX_IMAGES) {
      setImportError("Provide between 1 and 5 valid URLs.");
      return;
    }

    setImportStatus("importing");
    setImportError(null);
    setImportResults([]);
    setPendingAction(null);

    try {
      const { response, data } = await sendImportRequest(urls, replaceSlots);

      if (response.status === 409) {
        setRequiredReplaceSlotsCount(data.requiredReplaceSlotsCount ?? 0);
        if ((data.requiredReplaceSlotsCount ?? 0) > 1) {
          setPendingAction("import");
          setReplaceWarning(null);
        } else {
          setPendingAction(null);
          setReplaceWarning("Use the Replace button on an image to swap a single slot.");
        }
        setPendingUrls([...urls]);
        setImportStatus("error");
        setImportError(data.message ?? "Gallery full. Select slots to replace.");
        return;
      }

      if (!response.ok) {
        throw new Error(data?.message ?? "URL import failed");
      }

      applyRoomUpdate(data.room ?? null);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setImportResults(data.results ?? []);
      setImportStatus("success");
      setRequiredReplaceSlotsCount(0);
      setSelectedReplaceSlots([]);
      setReplaceWarning(null);
      setPendingUrls(null);
    } catch (error) {
      console.error("Room URL import failed:", error);
      setImportStatus("error");
      setImportError(
        error instanceof Error ? error.message : "URL import failed"
      );
    }
  };

  const handleUpload = async (replaceSlots?: number[]) => {
    if (!canUploadFiles) {
      setErrorMessage("Please select between 1 and 5 images.");
      return;
    }
    await handleUploadWithFiles(files, replaceSlots);
    setFiles([]);
  };

  const handleImportUrls = async (replaceSlots?: number[]) => {
    if (!canImportUrls) {
      setImportError("Provide between 1 and 5 valid URLs.");
      return;
    }
    await handleImportUrlsWithUrls(parsedUrls, replaceSlots);
    setUrlInput("");
  };

  const toggleReplaceSlot = (slot: number) => {
    setSelectedReplaceSlots((prev) => {
      if (prev.includes(slot)) {
        return prev.filter((value) => value !== slot);
      }
      if (prev.length >= requiredReplaceSlotsCount) {
        setReplaceWarning(
          `You can only replace ${requiredReplaceSlotsCount} image${
            requiredReplaceSlotsCount > 1 ? "s" : ""
          }.`
        );
        return prev;
      }
      setReplaceWarning(null);
      return [...prev, slot];
    });
  };

  const handleReplaceConfirm = async () => {
    if (selectedReplaceSlots.length !== requiredReplaceSlotsCount) {
      setReplaceWarning(
        `Select exactly ${requiredReplaceSlotsCount} image${
          requiredReplaceSlotsCount > 1 ? "s" : ""
        } to replace.`
      );
      return;
    }
    setReplaceWarning(null);
    if (pendingAction === "upload") {
      const filesToUpload = pendingFiles ?? [];
      await handleUploadWithFiles(
        filesToUpload,
        [...selectedReplaceSlots].sort((a, b) => a - b)
      );
    } else if (pendingAction === "import") {
      const urlsToImport = pendingUrls ?? [];
      await handleImportUrlsWithUrls(
        urlsToImport,
        [...selectedReplaceSlots].sort((a, b) => a - b)
      );
    }
    setSelectedReplaceSlots([]);
    setRequiredReplaceSlotsCount(0);
    setPendingAction(null);
    setPendingFiles(null);
    setPendingUrls(null);
  };

  const handleReplaceSingle = async (file: File, slot: number) => {
    if (!Number.isFinite(roomId)) {
      setReplaceWarning("Invalid room id.");
      return;
    }
    if (!isValidImageFile(file)) {
      setReplaceWarning("Only JPG, PNG, or WEBP images are allowed.");
      return;
    }
    setStatus("uploading");
    setReplaceWarning(null);
    try {
      const { response, data } = await sendUploadRequest([file], [slot]);
      if (!response.ok) {
        throw new Error(data?.message ?? "Replace failed");
      }
      applyRoomUpdate(data.room ?? null);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setStatus("success");
      setActiveReplaceSlot(null);
    } catch (error) {
      console.error("Replace single image failed:", error);
      setStatus("error");
      setReplaceWarning(
        error instanceof Error ? error.message : "Replace failed"
      );
    }
  };

  const handleDeleteImage = async (image: RoomImage) => {
    if (!Number.isFinite(roomId)) {
      setReplaceWarning("Invalid room id.");
      return;
    }
    if (deletingImageId) {
      return;
    }
    const confirmed = window.confirm("Delete this image?");
    if (!confirmed) {
      return;
    }
    setDeletingImageId(image.id);
    setReplaceWarning(null);
    try {
      const data = await apiFetch<{ room: Room }>(
        `/api/rooms/${roomId}/images/${image.id}`,
        { method: "DELETE" }
      );
      applyRoomUpdate(data.room ?? null);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setToastMessage("Image deleted.");
    } catch (error) {
      console.error("Delete image failed:", error);
      setReplaceWarning(
        error instanceof Error ? error.message : "Failed to delete image."
      );
    } finally {
      setDeletingImageId(null);
    }
  };

  const commitReorder = async (
    nextOrder: RoomImage[],
    previousOrder: RoomImage[]
  ) => {
    if (!Number.isFinite(roomId)) {
      setReorderError("Invalid room id.");
      setOrderedImages(previousOrder);
      return;
    }
    setIsReordering(true);
    setReorderError(null);
    setOrderedImages(nextOrder);

    try {
      const payload = nextOrder.map((image, index) => ({
        id: image.id,
        sortOrder: index + 1,
      }));
      const data = await apiFetch<{ room: Room }>(
        `/api/rooms/${roomId}/images/reorder`,
        {
          method: "PATCH",
          body: JSON.stringify({ order: payload }),
        }
      );
      applyRoomUpdate(data.room ?? null);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setToastMessage("Image order saved.");
    } catch (error) {
      console.error("Reorder images failed:", error);
      setReorderError(
        error instanceof Error ? error.message : "Failed to reorder images."
      );
      setOrderedImages(previousOrder);
    } finally {
      setIsReordering(false);
    }
  };

  const handleDragStartImage =
    (index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (!canReorder) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
      setDraggedIndex(index);
      setDragOverIndex(index);
    };

  const handleDragOverImage =
    (index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (!canReorder || draggedIndex === null) return;
      event.preventDefault();
      setDragOverIndex(index);
    };

  const handleDropImage =
    (index: number) => async (event: DragEvent<HTMLDivElement>) => {
      if (!canReorder || draggedIndex === null) return;
      event.preventDefault();
      setDraggedIndex(null);
      setDragOverIndex(null);

      if (index === draggedIndex) {
        return;
      }

      const previousOrder = orderedImages;
      const nextOrder = reorderList(previousOrder, draggedIndex, index);
      await commitReorder(nextOrder, previousOrder);
    };

  const handleDragEndImage = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (isLoadingMe) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <p className="text-sm text-(--color-stone)">Laddar...</p>
      </div>
    );
  }

  if (me?.user?.role !== "Admin") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <p className="text-sm text-red-500">
          Du saknar behörighet för att ladda upp bilder.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      {toastMessage && (
        <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 sm:left-auto sm:right-6 sm:top-6 sm:w-auto sm:max-w-none sm:translate-x-0 rounded-2xl bg-(--color-deep)/90 px-4 py-3 text-sm text-white shadow-lg">
          {toastMessage}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-(--color-gold)">
            Room images
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-(--color-deep)">
            {room?.name ?? `Room ${roomId}`}
          </h1>
          <p className="mt-2 text-sm text-(--color-forest)">
            Upload between 1 and 5 images for this room.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/rooms/${roomId}`}>
            <Button variant="outline">View room</Button>
          </Link>
          <Link href="/admin">
            <Button variant="outline">Back to admin</Button>
          </Link>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-(--color-deep)">
              Select images
            </h2>
            <span className="text-xs uppercase tracking-[0.2em] text-(--color-stone)">
              {files.length} / {MAX_IMAGES}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="w-full rounded-2xl border border-[rgba(29,42,56,0.15)] bg-white/80 px-4 py-3 text-sm text-(--color-ink)"
            />

            <div
              onPaste={handlePaste}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center text-sm transition ${
                isDragging
                  ? "border-(--color-gold) bg-white/90 text-(--color-deep)"
                  : "border-[rgba(29,42,56,0.3)] bg-white/60 text-(--color-stone)"
              }`}
            >
              Drag & drop images here or paste (Ctrl/Cmd + V)
            </div>

            {errorMessage && (
              <p className="text-sm text-red-500">{errorMessage}</p>
            )}

            <Button
              onClick={() => handleUpload()}
              disabled={!canUploadFiles || status === "uploading"}
              className="w-full"
            >
              {status === "uploading" ? "Uploading..." : "Upload images"}
            </Button>

            {status === "success" && (
              <p className="text-sm text-(--color-forest)">
                Images uploaded successfully.
              </p>
            )}
            {status === "error" && (
              <p className="text-sm text-red-500">
                Upload failed. Please try again.
              </p>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-(--color-deep)">
            Preview
          </h2>
          {files.length === 0 ? (
            <p className="mt-4 text-sm text-(--color-stone)">
              No images selected yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {previews.map((preview, index) => (
                <div
                  key={`${preview.url}-${index}`}
                  className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/80"
                >
                  <Image
                    src={preview.url}
                    alt={`Selected ${index + 1}`}
                    width={512}
                    height={128}
                    unoptimized
                    className="h-32 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-forest)"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-(--color-deep)">
              Import from URL
            </h2>
            <span className="text-xs uppercase tracking-[0.2em] text-(--color-stone)">
              {parsedUrls.length} / {MAX_IMAGES}
            </span>
          </div>
          <p className="mt-3 text-sm text-(--color-forest)">
            Paste up to 5 direct image URLs (one per line).
          </p>
          <textarea
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            rows={6}
            className="mt-4 w-full rounded-2xl border border-[rgba(29,42,56,0.15)] bg-white/80 px-4 py-3 text-sm text-(--color-ink) outline-none transition focus:border-(--color-gold)"
            placeholder="https://example.com/photo-1.jpg"
          />
          {!canImportUrls && urlInput.trim().length > 0 && (
            <p className="mt-2 text-xs text-red-500">
              Provide 1–5 valid URLs (http/https).
            </p>
          )}
          {importError && (
            <p className="mt-2 text-sm text-red-500">{importError}</p>
          )}
          <Button
            onClick={() => handleImportUrls()}
            disabled={!canImportUrls || importStatus === "importing"}
            className="mt-4 w-full"
          >
            {importStatus === "importing" ? "Importing..." : "Import URLs"}
          </Button>
          {importStatus === "success" && (
            <p className="mt-3 text-sm text-(--color-forest)">
              URL import finished.
            </p>
          )}
          {importResults.length > 0 && (
            <div className="mt-4 space-y-2 text-sm text-(--color-forest)">
              {importResults.map((result, idx) => (
                <div key={`${result.url}-${idx}`} className="flex flex-col">
                  <span className="break-all text-xs uppercase tracking-[0.15em] text-(--color-stone)">
                    {result.url}
                  </span>
                  <span
                    className={
                      result.status === "imported"
                        ? "text-(--color-forest)"
                        : "text-red-500"
                    }
                  >
                    {result.status === "imported"
                      ? `Imported (slot ${result.index})`
                      : `Failed: ${result.error ?? "Unknown error"}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-(--color-deep)">
            Current images
          </h2>
          {shouldSelectReplaceSlots && (
            <p className="mt-3 text-sm text-(--color-forest)">
              Select {requiredReplaceSlotsCount} image
              {requiredReplaceSlotsCount > 1 ? "s" : ""} to replace.
            </p>
          )}
          {orderedImages.length === 0 ? (
            <p className="mt-4 text-sm text-(--color-stone)">
              No images stored for this room yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {orderedImages.map((image, index) => {
                const slot = getSlotFromImage(image.path, image.sortOrder);
                const isSelected = slot ? selectedReplaceSlots.includes(slot) : false;
                const isDraggingCard = draggedIndex === index;
                const isDropTarget =
                  dragOverIndex === index &&
                  draggedIndex !== null &&
                  draggedIndex !== index;
                return (
                <div
                  key={image.id}
                  className={`group relative overflow-hidden rounded-2xl border bg-white/80 transition ${
                    isSelected
                      ? "border-(--color-gold) ring-2 ring-(--color-gold)"
                      : "border-white/60"
                  } ${
                    shouldSelectReplaceSlots
                      ? "cursor-pointer"
                      : canReorder
                        ? "cursor-grab"
                        : ""
                  } ${
                    isDraggingCard ? "opacity-70 scale-[0.99]" : ""
                  } ${isDropTarget ? "ring-2 ring-(--color-gold)" : ""}`}
                  draggable={canReorder}
                  onDragStart={handleDragStartImage(index)}
                  onDragOver={handleDragOverImage(index)}
                  onDrop={handleDropImage(index)}
                  onDragEnd={handleDragEndImage}
                  onClick={() => {
                    if (shouldSelectReplaceSlots && slot) {
                      toggleReplaceSlot(slot);
                    }
                  }}
                >
                  <Image
                    src={getPublicStorageUrl(
                      image.bucket,
                      image.path,
                      image.updatedAt,
                    )}
                    alt={image.alt || "Room image"}
                    width={512}
                    height={128}
                    unoptimized
                    className="h-32 w-full object-cover"
                  />
                  {shouldSelectReplaceSlots && slot && (
                    <div className="pointer-events-none absolute right-2 top-2">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold transition-all duration-200 ease-out ${
                          isSelected
                            ? "bg-(--color-deep) text-white border-(--color-deep) scale-100 opacity-100"
                            : "bg-white/80 text-(--color-forest) border-white/70 scale-95 opacity-70"
                        }`}
                      >
                        {isSelected ? "✓" : ""}
                      </div>
                    </div>
                  )}
                  {!shouldSelectReplaceSlots && (
                    <div className="absolute right-2 top-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (slot) {
                            setActiveReplaceSlot(slot);
                            replaceInputRef.current?.click();
                          }
                        }}
                        className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-(--color-forest) opacity-100 transition-all duration-200 ease-out hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteImage(image);
                        }}
                        disabled={deletingImageId === image.id}
                        className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-600 opacity-100 transition-all duration-200 ease-out hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        {deletingImageId === image.id ? "Deleting" : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
          {isReordering && (
            <p className="mt-3 text-sm text-(--color-stone)">
              Saving new order...
            </p>
          )}
          {reorderError && (
            <p className="mt-3 text-sm text-red-500">{reorderError}</p>
          )}
          {replaceWarning && (
            <p className="mt-3 text-sm text-red-500">{replaceWarning}</p>
          )}
          {shouldSelectReplaceSlots && (
            <Button
              onClick={handleReplaceConfirm}
              disabled={selectedReplaceSlots.length !== requiredReplaceSlotsCount}
              className="mt-4 w-full"
            >
              Replace selected
            </Button>
          )}
        </div>
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const list = event.target.files;
          if (!list || list.length === 0) {
            setActiveReplaceSlot(null);
            return;
          }
          const file = list[0];
          if (activeReplaceSlot) {
            handleReplaceSingle(file, activeReplaceSlot);
          }
          event.target.value = "";
        }}
      />

    </div>
  );
}





