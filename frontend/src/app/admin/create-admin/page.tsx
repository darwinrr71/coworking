"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

const createAdminSchema = z.object({
  username: z.string().min(3, "Minst 3 tecken"),
  password: z.string().min(6, "Minst 6 tecken"),
});

type CreateAdminInput = z.infer<typeof createAdminSchema>;

export default function CreateAdminPage() {
  const { data: me, isLoading: isLoadingMe } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ user: { username: string; role: string } }>("/api/me"),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (payload: CreateAdminInput) =>
      apiFetch<{ user: { username: string; role: string } }>("/api/user/create-admin", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateAdminInput>({
    resolver: zodResolver(createAdminSchema),
  });

  if (isLoadingMe) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
        <p className="text-sm text-(--color-stone)">Laddar...</p>
      </div>
    );
  }

  if (me?.user?.role !== "Admin") {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
        <p className="text-sm text-red-500">Du saknar behörighet för att skapa admin.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <div className="glass-panel rounded-[32px] p-8">
        <h1 className="text-3xl font-semibold text-(--color-deep)">Skapa admin</h1>
        <p className="mt-2 text-sm text-(--color-forest)">
          Endast administratörer kan skapa nya admin-konton.
        </p>
        <form
          className="mt-8 space-y-4"
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
        >
          <div>
            <Input placeholder="Användarnamn" {...register("username")} />
            {errors.username && (
              <p className="mt-2 text-xs text-(--color-stone)">
                {errors.username.message}
              </p>
            )}
          </div>
          <div>
            <Input type="password" placeholder="Lösenord" {...register("password")} />
            {errors.password && (
              <p className="mt-2 text-xs text-(--color-stone)">
                {errors.password.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? "Skapar..." : "Skapa admin"}
          </Button>
        </form>
        {mutation.isError && (
          <p className="mt-4 text-sm text-red-500">{mutation.error.message}</p>
        )}
        {mutation.isSuccess && (
          <p className="mt-4 text-sm text-(--color-forest)">
            Admin skapad: {mutation.data.user.username}
          </p>
        )}
        {mutation.isSuccess && (
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                reset();
              }}
            >
              Skapa en till
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}


