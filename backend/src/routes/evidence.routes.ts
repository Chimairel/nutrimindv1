import { ClinicalEvidenceDomain, ClinicalEvidenceSourceState } from '@prisma/client';
import { Router } from 'express';
import prisma from '@/lib/prisma';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

const router = Router();

/**
 * Public, read-only projection of the versioned evidence registry. Approval
 * state belongs to condition policies, so a source appearing here never means
 * that a draft rule is active or clinically approved.
 */
router.get('/sources', async (req, res) => {
  try {
    const requestedDomain = typeof req.query.domain === 'string' ? req.query.domain : undefined;
    if (requestedDomain && !Object.values(ClinicalEvidenceDomain).includes(requestedDomain as ClinicalEvidenceDomain)) {
      return res.status(400).json({ success: false, error: 'Unknown evidence domain.' });
    }
    const sources = await prisma.clinicalEvidenceSource.findMany({
      where: {
        state: ClinicalEvidenceSourceState.CURRENT,
        ...(requestedDomain ? { domain: requestedDomain as ClinicalEvidenceDomain } : {}),
      },
      select: {
        code: true,
        issuingOrganization: true,
        title: true,
        documentType: true,
        domain: true,
        canonicalUrl: true,
        archivedUrl: true,
        sourceVersion: true,
        publicationDate: true,
        retrievedAt: true,
        sectionLocator: true,
        population: true,
        jurisdiction: true,
        exclusionsAndCaveats: true,
      },
      orderBy: [{ domain: 'asc' }, { issuingOrganization: 'asc' }, { code: 'asc' }],
      take: 100,
    });
    return res.json({ success: true, data: sources });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Failed to load the evidence register.'),
    });
  }
});

export default router;
