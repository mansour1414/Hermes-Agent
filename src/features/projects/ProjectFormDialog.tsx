import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { useServices } from "@/services";
import { useI18n } from "@/i18n";
import { useUiStore } from "@/stores/uiStore";
import { PROJECT_COLORS, PROJECT_ICON_OPTIONS } from "@/features/projects/ProjectsPage";
import type { ProjectIcon } from "@/types";
import { cn } from "@/utils/cn";

const projectSchema = z.object({
  name: z.string().min(2, "name"),
  nameAr: z.string().min(2, "nameAr"),
  description: z.string().max(240, "description"),
  path: z.string().min(3, "path"),
  icon: z.string().min(1),
  color: z.string().min(4),
  preferredModelId: z.string().optional(),
  instructions: z.string().max(2000).optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export function ProjectFormDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const services = useServices();
  const pushToast = useUiStore((state) => state.pushToast);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [icon, setIcon] = useState<ProjectIcon>("rocket");
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      nameAr: "",
      description: "",
      path: "D:\\hermes\\workspace\\",
      icon: "rocket",
      color: PROJECT_COLORS[0],
      instructions: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    services.model
      .listModels()
      .then((list) => setModels(list.map((model) => ({ id: model.id, name: model.name }))))
      .catch(() => undefined);
    reset({
      name: "",
      nameAr: "",
      description: "",
      path: "D:\\hermes\\workspace\\",
      icon: "rocket",
      color: PROJECT_COLORS[0],
      instructions: "",
    });
  }, [open, services, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await services.project.createProject({
        name: values.name,
        nameAr: values.nameAr,
        description: values.description,
        path: values.path,
        icon: values.icon as ProjectIcon,
        color: values.color,
        preferredModelId: values.preferredModelId,
        instructions: values.instructions ?? "",
        toolIds: [],
        skillIds: [],
        fileCount: 0,
      });
      pushToast({ title: t("projects.created"), variant: "success" });
      onCreated();
    } catch (error) {
      pushToast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    }
  });

  const errorText = (key: string) => {
    const map: Record<string, string> = {
      name: t("projects.name"),
      nameAr: t("projects.name"),
      description: t("projects.description"),
      path: t("projects.path"),
    };
    return map[key] ? `${map[key]} — ${t("common.required")}` : t("common.required");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("projects.createProject")}
      description={t("projects.pathNote")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="project-form" loading={isSubmitting}>
            {t("projects.save")}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("projects.name")} htmlFor="project-name" required error={errors.name ? errorText("name") : undefined}>
            <Input id="project-name" {...register("name")} invalid={Boolean(errors.name)} placeholder="Atlas Dashboard" />
          </Field>
          <Field label={`${t("projects.name")} (عربي)`} htmlFor="project-name-ar" required error={errors.nameAr ? errorText("nameAr") : undefined}>
            <Input id="project-name-ar" {...register("nameAr")} invalid={Boolean(errors.nameAr)} placeholder="لوحة أطلس" dir="rtl" />
          </Field>
        </div>

        <Field label={t("projects.description")} htmlFor="project-description" error={errors.description ? errorText("description") : undefined}>
          <Textarea id="project-description" {...register("description")} invalid={Boolean(errors.description)} rows={3} />
        </Field>

        <Field label={t("projects.path")} htmlFor="project-path" required error={errors.path ? errorText("path") : undefined} hint={t("projects.pathNote")}>
          <Input id="project-path" {...register("path")} invalid={Boolean(errors.path)} className="font-mono text-[0.8125rem]" dir="ltr" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("projects.chooseIcon")} htmlFor="project-icon">
            <div className="flex flex-wrap gap-1.5" id="project-icon">
              {PROJECT_ICON_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setIcon(option);
                    setValue("icon", option);
                  }}
                  aria-pressed={icon === option}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border text-[0.6875rem] font-semibold uppercase transition-colors",
                    icon === option
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface-2 text-subtle hover:text-ink",
                  )}
                >
                  {option.slice(0, 2)}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t("projects.chooseColor")} htmlFor="project-color">
            <div className="flex flex-wrap gap-1.5" id="project-color">
              {PROJECT_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setColor(option);
                    setValue("color", option);
                  }}
                  aria-label={option}
                  aria-pressed={color === option}
                  className={cn(
                    "h-9 w-9 rounded-lg border-2 transition-transform",
                    color === option ? "border-ink scale-105" : "border-transparent",
                  )}
                  style={{ backgroundColor: option }}
                />
              ))}
            </div>
          </Field>
        </div>

        <Field label={t("projects.preferredModel")} htmlFor="project-model">
          <Select id="project-model" {...register("preferredModelId")}>
            <option value="">{t("common.none")}</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("projects.instructions")} htmlFor="project-instructions">
          <Textarea id="project-instructions" {...register("instructions")} rows={4} placeholder={t("projects.instructionsPlaceholder")} />
        </Field>
      </form>
    </Modal>
  );
}
