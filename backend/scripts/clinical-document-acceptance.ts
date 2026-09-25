import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ClinicalDocumentReviewDecision, ClinicalDocumentType, ClinicalEvidenceArea, ClinicalFactCode, HealthConditionType, Role } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';

async function main() {
  const suffix = randomUUID();
  let patientId: string | null = null;
  let rndUserId: string | null = null;
  const documentIds: string[] = [];
  try {
    const patient = await prisma.user.create({
      data: {
        name: 'Clinical evidence acceptance fixture', email: `clinical-fixture-${suffix}@example.invalid`,
        passwordHash: 'fixture-unusable', role: Role.USER,
        healthConditions: { create: { condition: HealthConditionType.KIDNEY_DISEASE } },
      },
    });
    patientId = patient.id;
    const rnd = await prisma.user.create({
      data: {
        name: 'Clinical review acceptance fixture', email: `clinical-rnd-${suffix}@example.invalid`,
        passwordHash: 'fixture-unusable', role: Role.NUTRITIONIST,
        nutritionistProfile: { create: { prcLicenseNumber: `TEST-${suffix}`, prcLicenseExpiry: new Date('2030-01-01'), isVerified: true } },
      },
      include: { nutritionistProfile: true },
    });
    rndUserId = rnd.id;
    const nutritionistProfileId = rnd.nutritionistProfile!.id;

    let requirements = await ClinicalEvidenceService.requirementsForUser(patient.id);
    assert.equal(requirements[0].state, 'DOCUMENT_REVIEW_REQUIRED');
    const original = await ClinicalEvidenceService.upload({
      userId: patient.id, area: ClinicalEvidenceArea.KIDNEY_DISEASE,
      documentType: ClinicalDocumentType.MEDICAL_ABSTRACT,
      file: { buffer: Buffer.from('%PDF-1.7\nfixture only'), mimetype: 'application/pdf', originalname: 'fixture.pdf' },
      consentAccepted: true,
    });
    documentIds.push(original.id);
    assert.equal((await ClinicalEvidenceService.requirementsForUser(patient.id))[0].state, 'DOCUMENT_REVIEW_REQUIRED');
    const detail = await ClinicalEvidenceService.claimDetail(nutritionistProfileId, original.id);
    assert.equal(detail.user.id, patient.id);
    const file = await ClinicalEvidenceService.fileForClaimedReview(nutritionistProfileId, rnd.id, original.id);
    assert.equal(file.buffer.toString(), '%PDF-1.7\nfixture only');
    await ClinicalEvidenceService.review({
      nutritionistProfileId, actorUserId: rnd.id, documentId: original.id,
      decision: ClinicalDocumentReviewDecision.SUFFICIENT, rationale: 'Fixture stage is legible for nutrition context only.',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      confirmedFacts: [{ code: ClinicalFactCode.CKD_STAGE, valueText: 'G3' }],
    });
    requirements = await ClinicalEvidenceService.requirementsForUser(patient.id);
    assert.equal(requirements[0].state, 'READY');
    assert.deepEqual(requirements[0].readyDocumentIds, [original.id]);

    const replacement = await ClinicalEvidenceService.upload({
      userId: patient.id, area: ClinicalEvidenceArea.KIDNEY_DISEASE,
      documentType: ClinicalDocumentType.LABORATORY_REPORT,
      supersedesDocumentId: original.id,
      file: { buffer: Buffer.from('%PDF-1.7\nupdated fixture'), mimetype: 'application/pdf', originalname: 'updated.pdf' },
      consentAccepted: true,
    });
    documentIds.push(replacement.id);
    assert.equal((await ClinicalEvidenceService.requirementsForUser(patient.id))[0].state, 'DOCUMENT_REVIEW_REQUIRED');
    await ClinicalEvidenceService.withdraw(patient.id, replacement.id);
    assert.equal((await ClinicalEvidenceService.requirementsForUser(patient.id))[0].state, 'DOCUMENT_REVIEW_REQUIRED');
    console.log(JSON.stringify({ result: 'pass', flow: 'upload → RND review → replace → withdraw', fixtureDocuments: documentIds.length }));
  } finally {
    if (patientId || rndUserId) {
      await prisma.auditEvent.deleteMany({ where: { OR: [{ actorUserId: { in: [patientId, rndUserId].filter((id): id is string => Boolean(id)) } }, { entityType: 'ClinicalDocument', entityId: { in: documentIds } }] } });
    }
    if (patientId) await prisma.user.delete({ where: { id: patientId } });
    if (rndUserId) await prisma.user.delete({ where: { id: rndUserId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
