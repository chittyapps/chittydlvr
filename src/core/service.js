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

export class ServiceEngine {
  constructor(dlvr) {
    this.dlvr = dlvr;
  }

  /**
   * Initiate service of process
   *
   * @param {Object} options
   * @param {string} options.mintId - Document to serve
   * @param {string} options.respondent - Person being served
   * @param {string} options.serviceType - personal, substituted, constructive, publication
   * @param {Object} options.address - Address for service
   * @param {string} options.jurisdiction - Legal jurisdiction
   * @param {string} options.timestamp
   * @returns {Promise<ServiceResult>}
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

    const serviceId = this.generateServiceId();

    return {
      serviceId,
      mintId,
      respondent,
      serviceType,
      address,
      jurisdiction,

      // Process server assignment
      processServer: null, // Assigned when server accepts
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
        score: 0, // Scored when service is completed
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
   *
   * @param {string} serviceId
   * @param {Object} attempt
   * @returns {Promise<AttemptResult>}
   */
  async recordAttempt(serviceId, attempt) {
    const timestamp = new Date().toISOString();

    return {
      serviceId,
      attemptNumber: attempt.attemptNumber || 1,
      successful: attempt.successful || false,
      servedTo: attempt.servedTo || null,
      relationship: attempt.relationship || null, // For substituted service
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
   *
   * @param {Object} options
   * @param {string} options.serviceId
   * @param {string} options.processServer - Server who performed service
   * @param {string} options.serviceType - How service was completed
   * @param {Object} options.details - Affidavit details
   * @returns {Promise<ServiceProof>}
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
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `DS-${timestamp}-${random}`.toUpperCase();
  }

  generateAffidavitId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `DA-${timestamp}-${random}`.toUpperCase();
  }
}

export default ServiceEngine;
