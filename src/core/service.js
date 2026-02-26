/**
 * Service Engine
 * Legal service of process — the highest-proof delivery method.
 *
 * Handles:
 * - Personal service (hand delivery)
 * - Substituted service (left with someone at address)
 * - Constructive service (posted on door)
 * - Service by publication (newspaper notice)
 *
 * Each produces an affidavit of service that scores 95 on the delivery pillar.
 */

const VALID_SERVICE_TYPES = ['personal', 'substituted', 'constructive', 'publication'];

export class ServiceEngine {
  constructor(dlvr) {
    this.dlvr = dlvr;
  }

  /**
   * Initiate service of process
   */
  async initiate(options) {
    const {
      mintId,
      respondent,
      serviceType = 'personal',
      address,
      jurisdiction,
      timestamp
    } = options;

    if (!VALID_SERVICE_TYPES.includes(serviceType)) {
      throw new Error(`Invalid service type: ${serviceType}. Valid types: ${VALID_SERVICE_TYPES.join(', ')}`);
    }

    const serviceId = this.generateServiceId();

    return {
      serviceId,
      mintId,
      respondent,
      serviceType,
      address,
      jurisdiction,

      // Process server assignment
      processServer: null,
      serverAssigned: false,

      // Status
      status: 'INITIATED',
      statusHistory: [
        { status: 'INITIATED', timestamp, actor: 'system' }
      ],

      // Attempts tracking
      attempts: [],
      maxAttempts: this.getMaxAttempts(serviceType),

      // Requirements per service type
      requirements: this.getRequirements(serviceType),

      // Proof
      proof: {
        pillar: 'delivery',
        method: 'legalService',
        serviceType,
        score: 0,
        affidavitFiled: false
      },

      // Timestamps
      createdAt: timestamp,
      servedAt: null,
      affidavitFiledAt: null,

      // Verification
      trackingUrl: `https://chitty.cc/service/${serviceId}`
    };
  }

  /**
   * Record a service attempt
   */
  async recordAttempt(serviceId, attempt) {
    const timestamp = new Date().toISOString();

    return {
      serviceId,
      attemptNumber: attempt.attemptNumber || 1,
      successful: attempt.successful || false,
      servedTo: attempt.servedTo || null,
      relationship: attempt.relationship || null,
      location: attempt.location || null,
      geoVerified: attempt.geoVerified || false,
      processServer: attempt.processServer,
      notes: attempt.notes || null,
      timestamp,
      witnessed: true,
      witness: 'ChittyOS'
    };
  }

  /**
   * Record affidavit of service (proof of service)
   */
  async recordAffidavit(options) {
    const {
      serviceId,
      processServer,
      serviceType = 'personal',
      details = {},
      timestamp
    } = options;

    const affidavitId = this.generateAffidavitId();

    return {
      affidavitId,
      serviceId,

      // Who served
      processServer,
      serverLicensed: true,
      serverJurisdiction: details.jurisdiction || null,

      // How served
      serviceType,
      servedTo: details.servedTo || null,
      relationship: details.relationship || null,
      location: details.location || null,

      // Sworn statement
      sworn: true,
      notarized: details.notarized || false,
      witnessPresent: details.witnessPresent || false,

      // Scoring
      proof: {
        pillar: 'delivery',
        method: 'legalService',
        score: this.scoreAffidavit(serviceType, details),
        technical: this.scoreTechnical(serviceType, details),
        arguable: this.scoreArguable(serviceType, details)
      },

      // Status
      status: 'FILED',

      // Timestamps
      servedAt: details.servedAt || timestamp,
      filedAt: timestamp,
      createdAt: timestamp,

      // Verification
      verifyUrl: `https://chitty.cc/affidavit/${affidavitId}`
    };
  }

  // ============ Requirements ============

  getRequirements(serviceType) {
    const reqs = {
      personal: {
        inPerson: true,
        identifyRespondent: true,
        handDeliver: true,
        affidavitRequired: true,
        witnessOptional: true
      },
      substituted: {
        atAddress: true,
        competentPerson: true,
        mailCopy: true,
        affidavitRequired: true,
        courtOrderMayBeRequired: true
      },
      constructive: {
        postedOnDoor: true,
        mailCopy: true,
        affidavitRequired: true,
        courtOrderRequired: true
      },
      publication: {
        newspaperNotice: true,
        courtOrderRequired: true,
        durationWeeks: 4,
        affidavitRequired: true,
        proofOfPublication: true
      }
    };

    return reqs[serviceType] || reqs.personal;
  }

  getMaxAttempts(serviceType) {
    const attempts = {
      personal: 3,
      substituted: 2,
      constructive: 1,
      publication: 1
    };
    return attempts[serviceType] || 3;
  }

  // ============ Scoring ============

  scoreAffidavit(serviceType, details) {
    const base = { personal: 95, substituted: 80, constructive: 70, publication: 65 };
    let score = base[serviceType] || 70;
    if (details.notarized) score = Math.min(100, score + 5);
    if (details.witnessPresent) score = Math.min(100, score + 3);
    return score;
  }

  scoreTechnical(serviceType, details) {
    const base = { personal: 90, substituted: 75, constructive: 65, publication: 60 };
    let score = base[serviceType] || 65;
    if (details.geoVerified) score = Math.min(100, score + 5);
    return score;
  }

  scoreArguable(serviceType, details) {
    const base = { personal: 95, substituted: 85, constructive: 75, publication: 70 };
    let score = base[serviceType] || 70;
    if (details.notarized) score = Math.min(100, score + 5);
    if (details.witnessPresent) score = Math.min(100, score + 5);
    return score;
  }

  // ============ ID Generation ============

  generateServiceId() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const random = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `DS-${Date.now().toString(36)}-${random}`.toUpperCase();
  }

  generateAffidavitId() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const random = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `DA-${Date.now().toString(36)}-${random}`.toUpperCase();
  }
}

export default ServiceEngine;
