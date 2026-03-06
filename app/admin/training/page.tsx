"use client"

import TrainingAnnotationEditorModal from "@/components/admin/training/training-annotation-editor-modal"
import TrainingHeader from "@/components/admin/training/training-header"
import TrainingPipelinePanel from "@/components/admin/training/training-pipeline-panel"
import TrainingSamplesPanel from "@/components/admin/training/training-samples-panel"
import TrainingUploadForm from "@/components/admin/training/training-upload-form"
import { useAdminTrainingPage } from "@/components/admin/training/use-admin-training-page"

export default function AdminTrainingPage() {
  const training = useAdminTrainingPage()

  if (!training.ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-100 [font-family:var(--font-geist-sans)]">
        <p className="text-sm text-slate-300">Memuat modul training admin...</p>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 [font-family:var(--font-geist-sans)]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <TrainingHeader
          username={training.session?.username ?? null}
          totalSamples={training.totals.total}
          queued={training.totals.queued}
          uploaded={training.totals.uploaded}
          failed={training.totals.failed}
          onLogout={training.handleLogout}
        />

        <TrainingUploadForm
          onSubmit={training.handleSaveSample}
          isSubmitting={training.isSavingSample}
          statusMessage={training.formMessage}
        />

        <TrainingPipelinePanel
          config={training.config}
          pendingCount={training.totals.queued}
          uploadedCount={training.totals.uploaded}
          failedCount={training.totals.failed}
          pipelineState={training.pipelineState}
          runtime={training.runtime}
          onUploadPending={training.handleUploadPending}
          onRetryFailed={training.handleRetryFailed}
          onTriggerTraining={training.handleTriggerTraining}
          onSyncTrainingStatus={training.handleSyncTrainingStatus}
          onSetInferenceTarget={training.handleSetInferenceTarget}
          onCheckInferenceHealth={training.handleCheckInferenceHealth}
          onResumeDeployment={training.handleResumeDeployment}
          onCheckDeploymentStatus={training.handleCheckDeploymentStatus}
          runningAction={training.runningAction}
          statusMessage={training.pipelineMessage}
        />

        <TrainingSamplesPanel
          samples={training.samples}
          deletingId={training.deletingId}
          onEditAnnotations={training.handleEditAnnotations}
          onDelete={training.handleDeleteSample}
        />
      </section>

      <TrainingAnnotationEditorModal
        key={training.editorSample?.id ?? "training-editor"}
        sample={training.editorSample}
        open={training.editorSample !== null}
        saving={training.isSavingAnnotations}
        onClose={() => training.setEditorSample(null)}
        onSave={training.handleSaveAnnotations}
      />
    </main>
  )
}
