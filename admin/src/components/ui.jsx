import { cn } from "../lib/utils";

// ── Badge ──────────────────────────────────────────────────────────────────
const badgeVariants = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-success/15 text-success border-success/25",
  warning: "bg-warning/15 text-warning border-warning/25",
  destructive: "bg-destructive/15 text-red-400 border-destructive/25",
  info: "bg-info/15 text-info border-info/25",
  outline: "text-foreground border-border",
};

export function Badge({ variant = "default", className, children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        badgeVariants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Button ─────────────────────────────────────────────────────────────────
const buttonVariants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  success: "bg-success/15 text-success hover:bg-success/25 border border-success/25",
};

const buttonSizes = {
  default: "h-9 px-4 py-2",
  sm: "h-8 px-3 text-xs",
  xs: "h-7 px-2 text-xs",
  lg: "h-10 px-6",
  icon: "h-9 w-9",
  "icon-sm": "h-7 w-7",
};

export function Button({
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        "cursor-pointer",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────
export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn("rounded-xl border bg-card text-card-foreground", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return (
    <div className={cn("flex flex-col space-y-1.5 p-5", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }) {
  return (
    <h3 className={cn("font-semibold leading-none tracking-tight", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
  );
}

export function CardContent({ className, children }) {
  return <div className={cn("p-5 pt-0", className)}>{children}</div>;
}

// ── Input ──────────────────────────────────────────────────────────────────
export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

// ── Separator ──────────────────────────────────────────────────────────────
export function Separator({ className, orientation = "horizontal" }) {
  return (
    <div
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────────
export function Tabs({ value, onValueChange, children }) {
  return (
    <div data-value={value}>
      {typeof children === "function" ? children(value, onValueChange) : children}
    </div>
  );
}

export function TabsList({ className, children }) {
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, activeValue, onClick, children, className }) {
  const isActive = value === activeValue;
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all cursor-pointer",
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "hover:text-foreground/80",
        className,
      )}
      onClick={() => onClick(value)}
    >
      {children}
    </button>
  );
}
