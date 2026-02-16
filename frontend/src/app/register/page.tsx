"use client";

import { Suspense } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { RegisterInput, registerSchema } from "@/lib/validators";
import { useRouter, useSearchParams } from "next/navigation";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const redirectTarget = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/";
  const mutation = useMutation({
    mutationFn: (payload: RegisterInput) =>
      apiFetch<{ user: { username: string } }>("/api/user/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      router.replace(redirectTarget);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
      <div className="glass-panel rounded-[32px] p-8">
        <h1 className="text-3xl font-semibold text-(--color-deep)">Skapa konto</h1>
        <p className="mt-2 text-sm text-(--color-forest)">
          Registrera dig för att boka rum och hantera dina reserveringar.
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
            {mutation.isPending ? "Skapar konto..." : "Registrera"}
          </Button>
        </form>
        {mutation.isError && (
          <p className="mt-4 text-sm text-red-500">{mutation.error.message}</p>
        )}
        {mutation.isSuccess && (
          <p className="mt-4 text-sm text-(--color-forest)">
            Kontot är klart. Du kan nu boka rum.
          </p>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
          <div className="glass-panel rounded-[32px] p-8">
            <p className="text-sm text-(--color-stone)">Laddar...</p>
          </div>
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}


