import { Spinner } from "@heroui/react";

export function RuntimeLoadingScreen({ message }: { message: string }) {
	return (
		<main className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
			<div
				role="status"
				aria-live="polite"
				className="flex flex-col items-center gap-3"
			>
				<Spinner color="accent" size="lg" aria-label={message} />
				<p className="text-sm text-muted">{message}</p>
			</div>
		</main>
	);
}
