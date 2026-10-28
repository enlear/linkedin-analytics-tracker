"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Loader2, Plus, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MAX_CATEGORY_WEIGHT,
  MIN_CATEGORY_WEIGHT,
  type PostCategory,
} from "@/lib/post-categories";
import {
  createPostCategory,
  restoreDefaultCategories,
  updatePostCategory,
  type CategoryActionResult,
} from "./category-actions";

interface Props {
  categories: PostCategory[];
}

interface Draft {
  name: string;
  description: string;
  weight: string;
}

const EMPTY_DRAFT: Draft = { name: "", description: "", weight: "1" };

function throwOnError(res: CategoryActionResult) {
  if (!res.ok) throw new Error(res.message);
}

/**
 * Checks a draft against the bounds and the other categories' names. Returns
 * the cleaned values, or an error message to toast.
 */
function validate(
  draft: Draft,
  others: PostCategory[],
): { name: string; description: string | null; weight: number } | string {
  const name = draft.name.trim();
  if (!name) return "Name is required.";
  if (others.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return `A category named "${name}" already exists.`;
  }
  const weight = Number(draft.weight);
  if (!Number.isFinite(weight) || weight < MIN_CATEGORY_WEIGHT || weight > MAX_CATEGORY_WEIGHT) {
    return `Weight must be between ${MIN_CATEGORY_WEIGHT} and ${MAX_CATEGORY_WEIGHT}.`;
  }
  return { name, description: draft.description.trim() || null, weight };
}

export function PostCategoriesManager({ categories }: Props) {
  const router = useRouter();
  const [seeding, startSeed] = useTransition();

  function handleSeed() {
    startSeed(async () => {
      try {
        throwOnError(await restoreDefaultCategories());
        toast.success("Default categories added.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add categories.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {categories.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-sm space-y-3">
          <p className="text-muted-foreground">
            No categories found — employees can&apos;t upload until at least one exists. They
            are normally seeded by the database setup; restore the defaults (Article,
            Direct post, Event update, Other) and tune them from there.
          </p>
          <Button size="sm" onClick={handleSeed} disabled={seeding}>
            {seeding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Add default categories
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              others={categories.filter((o) => o.id !== c.id)}
            />
          ))}
        </div>
      )}

      <NewCategoryForm existing={categories} />
    </div>
  );
}

function CategoryRow({ category, others }: { category: PostCategory; others: PostCategory[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({
    name: category.name,
    description: category.description ?? "",
    weight: String(category.weight),
  });
  const [pending, startTransition] = useTransition();

  const dirty =
    draft.name !== category.name ||
    draft.description !== (category.description ?? "") ||
    Number(draft.weight) !== category.weight;

  function save(patch: Partial<Pick<PostCategory, "active">> = {}) {
    const checked = validate(draft, others);
    if (typeof checked === "string") {
      toast.error(checked);
      return;
    }
    startTransition(async () => {
      try {
        throwOnError(await updatePostCategory(category.id, { ...checked, ...patch }));
        toast.success(
          patch.active === false
            ? `"${checked.name}" archived.`
            : patch.active === true
              ? `"${checked.name}" restored.`
              : `"${checked.name}" saved.`,
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  return (
    <div className="p-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem]">
        <Input
          aria-label="Category name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          disabled={pending}
        />
        <Input
          aria-label="Weight"
          type="number"
          inputMode="decimal"
          step="0.05"
          min={MIN_CATEGORY_WEIGHT}
          max={MAX_CATEGORY_WEIGHT}
          value={draft.weight}
          onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
          disabled={pending}
        />
      </div>
      <Input
        aria-label="Description"
        placeholder="Description shown to employees (optional)"
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        disabled={pending}
      />
      <div className="flex flex-wrap items-center gap-2">
        {category.active ? null : <Badge variant="secondary">Archived</Badge>}
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => save()} disabled={pending || !dirty}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => save({ active: !category.active })}
            disabled={pending}
          >
            {category.active ? (
              <>
                <Archive className="w-4 h-4" />
                Archive
              </>
            ) : (
              <>
                <ArchiveRestore className="w-4 h-4" />
                Restore
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewCategoryForm({ existing }: { existing: PostCategory[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    const checked = validate(draft, existing);
    if (typeof checked === "string") {
      toast.error(checked);
      return;
    }
    startTransition(async () => {
      try {
        throwOnError(await createPostCategory(checked));
        toast.success(`"${checked.name}" added.`);
        setDraft(EMPTY_DRAFT);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add category.");
      }
    });
  }

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Add a category
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem]">
        <Input
          aria-label="New category name"
          placeholder="Name, e.g. Podcast episode"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          disabled={pending}
        />
        <Input
          aria-label="New category weight"
          type="number"
          inputMode="decimal"
          step="0.05"
          min={MIN_CATEGORY_WEIGHT}
          max={MAX_CATEGORY_WEIGHT}
          value={draft.weight}
          onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
          disabled={pending}
        />
      </div>
      <Input
        aria-label="New category description"
        placeholder="Description shown to employees (optional)"
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        disabled={pending}
      />
      <Button size="sm" onClick={handleCreate} disabled={pending}>
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Add category
      </Button>
    </div>
  );
}
