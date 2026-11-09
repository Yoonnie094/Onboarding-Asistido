"use client";

import { useState } from "react";
import { MappingReview } from "@/features/onboarding/data/mapping-review";
import { UploadDropzone } from "@/features/onboarding/data/upload-dropzone";
import { StepFooter } from "@/features/onboarding/step-footer";
import { missingRequiredFields, suggestMapping } from "@/lib/onboarding/mapping";
import type { ParsedSpreadsheet } from "@/lib/onboarding/spreadsheet";
import type { SpreadsheetDraft, StepProps } from "@/lib/onboarding/types";

/** Planilla "vacía" marcada como omitida (los cuarteles saldrán solo del mapa). */
export function skippedSpreadsheet(previous: SpreadsheetDraft | null): SpreadsheetDraft {
  if (previous) return { ...previous, skipped: true, mappingConfirmed: false };
  return {
    fileName: "",
    sheetName: null,
    headers: [],
    rawRows: [],
    mapping: {},
    autoDetected: [],
    mappingConfirmed: false,
    skipped: true,
    uploadedAt: new Date().toISOString(),
  };
}

export function DatosStep({ draft, update, goNext, goBack, skip }: StepProps) {
  const sheet = draft.spreadsheet;
  const [replacing, setReplacing] = useState(false);
  const hasSheet = Boolean(sheet && !sheet.skipped && sheet.rawRows.length > 0);
  const showMapping = hasSheet && !replacing && sheet;
  const mapBlockCount = draft.cartography && !draft.cartography.skipped ? draft.cartography.features.length : 0;

  function handleParsed(fileName: string, parsed: ParsedSpreadsheet) {
    const suggestion = suggestMapping(parsed.headers, parsed.rows);
    update({
      spreadsheet: {
        fileName,
        sheetName: parsed.sheetName,
        headers: parsed.headers,
        rawRows: parsed.rows,
        mapping: suggestion.mapping,
        autoDetected: suggestion.autoDetected,
        mappingConfirmed: false,
        skipped: false,
        uploadedAt: new Date().toISOString(),
      },
    });
    setReplacing(false);
  }

  function handleSkip() {
    update({ spreadsheet: skippedSpreadsheet(sheet) });
    skip();
  }

  if (!showMapping) {
    return (
      <div>
        <p className="mb-5 max-w-2xl text-sm text-muted">
          Sube la planilla donde ya tienes la información de tus cuarteles: variedad, año de plantación, densidad,
          superficie… Nosotros reconocemos tus columnas, revisamos la calidad de los datos y te ayudamos a corregirlos.
        </p>
        <UploadDropzone
          mapBlockCount={mapBlockCount}
          onCancel={hasSheet ? () => setReplacing(false) : undefined}
          onParsed={handleParsed}
        />
        <StepFooter
          hint={
            mapBlockCount > 0
              ? "Sube una planilla o usa la de ejemplo. Si la omites, los cuarteles se crearán solo con el mapa."
              : "Sube una planilla o usa la de ejemplo para continuar."
          }
          nextDisabled
          onBack={goBack}
          onNext={() => undefined}
          onSkip={handleSkip}
        />
      </div>
    );
  }

  const missing = missingRequiredFields(sheet.mapping);
  const codeMissing = missing.includes("code");

  return (
    <div>
      <MappingReview
        onChangeMapping={(mapping) => update({ spreadsheet: { ...sheet, mapping, mappingConfirmed: false } })}
        onReplace={() => setReplacing(true)}
        sheet={sheet}
      />
      <StepFooter
        hint={codeMissing ? "Asigna la columna con el código de cuartel para continuar." : null}
        nextDisabled={codeMissing}
        nextLabel="Confirmar mapeo"
        onBack={goBack}
        onNext={() => {
          update({ spreadsheet: { ...sheet, mappingConfirmed: true, skipped: false } });
          goNext();
        }}
        onSkip={handleSkip}
      />
    </div>
  );
}
