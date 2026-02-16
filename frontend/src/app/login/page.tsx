"use client";

import { Suspense, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { LoginInput, loginSchema } from "@/lib/validators";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const redirectTarget = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/";
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ user: { username: string; role: string } }>("/api/me"),
    retry: false,
  });

  useEffect(() => {
    if (me?.user) {
      router.replace(redirectTarget);
    }
  }, [me, router, redirectTarget]);

  const mutation = useMutation({
    mutationFn: (payload: LoginInput) =>
      apiFetch<{ user: { username: string } }>("/api/user/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace(redirectTarget);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  if (me?.user) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
      <div className="glass-panel rounded-[32px] p-8">
        <h1 className="text-3xl font-semibold text-(--color-deep)">Logga in</h1>
        <p className="mt-2 text-sm text-(--color-forest)">
          Välkommen tillbaka. Ditt konto är säkrat med httpOnly-cookie.
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
            {mutation.isPending ? "Loggar in..." : "Logga in"}
          </Button>
        </form>
        <div className="mt-6 text-center">
          <Link
            href={`/register?redirect=${encodeURIComponent(redirectTarget)}`}
            className="text-sm font-semibold text-(--color-forest) transition hover:text-(--color-ink)"
          >
            Skapa konto
          </Link>
        </div>
        {mutation.isError && (
          <p className="mt-4 text-sm text-red-500">{mutation.error.message}</p>
        )}
        {mutation.isSuccess && (
          <p className="mt-4 text-sm text-(--color-forest)">
            Inloggning klar. Du är redo att boka.
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
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
      <LoginPageContent />
    </Suspense>
  );
}


