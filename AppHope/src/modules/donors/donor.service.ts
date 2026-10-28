import type { Donor, Prisma } from '@prisma/client';
import { DonorRepository } from './donor.repository.js';
import type {
  CreateDonorInput,
  DonorFilters,
  DonorProfile,
  UpdateDonorInput,
} from './donor.types.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.types.js';
import { normalizeCurrency } from '../../shared/currency.js';
import { ConflictError, NotFoundError } from '../../shared/errors.js';
import { ORGANIZATION_COUNTRY, isInternational, normalizeCountry } from '../../shared/geography.js';
import type { DbClient, PaginationOptions } from '../../shared/types.js';
import { normalizeEmail, optionalText, requireText } from '../../shared/validation.js';

/**
 * Gestion des donateurs.
 *
 * POINT DE MODELE IMPORTANT : il n'existe pas de "donateur international".
 * Un donateur possede un TYPE (INDIVIDUAL, COMPANY, FOUNDATION...) et un
 * PAYS. Le caractere international se deduit du pays (voir shared/geography).
 */
export class DonorService {
  constructor(
    private readonly donorRepository: DonorRepository = new DonorRepository(),
    private readonly auditService: AuditService = new AuditService(),
  ) {}

  async createDonor(input: CreateDonorInput, tx?: DbClient): Promise<Donor> {
    const email = normalizeEmail(input.email);

    const existing = await this.donorRepository.findByEmail(email, tx);
    if (existing) {
      throw new ConflictError(`Un donateur utilise deja l'adresse email ${email}.`, {
        email,
        donorId: existing.id,
      });
    }

    const donor = await this.donorRepository.create(
      {
        firstName: requireText(input.firstName, 'firstName', 120),
        lastName: requireText(input.lastName, 'lastName', 120),
        organizationName: optionalText(input.organizationName, 'organizationName', 180),
        email,
        phone: requireText(input.phone, 'phone', 40),
        donorType: input.donorType,
        country: normalizeCountry(input.country),
        preferredCurrency: normalizeCurrency(input.preferredCurrency, 'preferredCurrency'),
        preferredLanguage: optionalText(input.preferredLanguage, 'preferredLanguage', 10),
        timezone: optionalText(input.timezone, 'timezone', 64),
        address: optionalText(input.address, 'address'),
        city: optionalText(input.city, 'city', 120),
        profession: optionalText(input.profession, 'profession', 120),
        website: optionalText(input.website, 'website', 255),
        discoverySource: optionalText(input.discoverySource, 'discoverySource', 120),
      },
      tx,
    );

    await this.auditService.record(
      {
        entityType: AUDIT_ENTITIES.DONOR,
        entityId: donor.id,
        action: AUDIT_ACTIONS.DONOR_CREATED,
        newData: donor,
      },
      tx,
    );

    return donor;
  }

  async updateDonor(id: string, input: UpdateDonorInput, tx?: DbClient): Promise<Donor> {
    const current = await this.getDonorById(id, tx);

    const data: Prisma.DonorUncheckedUpdateInput = {};

    if (input.firstName !== undefined) data.firstName = requireText(input.firstName, 'firstName', 120);
    if (input.lastName !== undefined) data.lastName = requireText(input.lastName, 'lastName', 120);
    if (input.phone !== undefined) data.phone = requireText(input.phone, 'phone', 40);
    if (input.donorType !== undefined) data.donorType = input.donorType;
    if (input.country !== undefined) data.country = normalizeCountry(input.country);
    if (input.preferredCurrency !== undefined) {
      data.preferredCurrency = normalizeCurrency(input.preferredCurrency, 'preferredCurrency');
    }
    if (input.organizationName !== undefined) {
      data.organizationName = optionalText(input.organizationName, 'organizationName', 180);
    }
    if (input.preferredLanguage !== undefined) {
      data.preferredLanguage = optionalText(input.preferredLanguage, 'preferredLanguage', 10);
    }
    if (input.timezone !== undefined) data.timezone = optionalText(input.timezone, 'timezone', 64);
    if (input.address !== undefined) data.address = optionalText(input.address, 'address');
    if (input.city !== undefined) data.city = optionalText(input.city, 'city', 120);
    if (input.profession !== undefined) {
      data.profession = optionalText(input.profession, 'profession', 120);
    }
    if (input.website !== undefined) data.website = optionalText(input.website, 'website', 255);
    if (input.discoverySource !== undefined) {
      data.discoverySource = optionalText(input.discoverySource, 'discoverySource', 120);
    }

    if (input.email !== undefined) {
      const email = normalizeEmail(input.email);
      if (email !== current.email) {
        const duplicate = await this.donorRepository.findByEmail(email, tx);
        if (duplicate) {
          throw new ConflictError(`Un donateur utilise deja l'adresse email ${email}.`, { email });
        }
      }
      data.email = email;
    }

    const updated = await this.donorRepository.update(id, data, tx);

    await this.auditService.record(
      {
        entityType: AUDIT_ENTITIES.DONOR,
        entityId: id,
        action: AUDIT_ACTIONS.DONOR_UPDATED,
        oldData: current,
        newData: updated,
      },
      tx,
    );

    return updated;
  }

  async getDonorById(id: string, tx?: DbClient): Promise<Donor> {
    const donor = await this.donorRepository.findById(id, tx);
    if (!donor) throw new NotFoundError('Donateur', id);
    return donor;
  }

  async findDonorByEmail(email: string, tx?: DbClient): Promise<Donor | null> {
    return this.donorRepository.findByEmail(normalizeEmail(email), tx);
  }

  /** Vue enrichie utilisee par les rapports et les scripts de demonstration. */
  async getDonorProfile(id: string, tx?: DbClient): Promise<DonorProfile> {
    const donor = await this.getDonorById(id, tx);
    return {
      donor,
      displayName: buildDisplayName(donor),
      isInternational: isInternational(donor.country),
    };
  }

  async listDonors(filters: DonorFilters = {}, options: PaginationOptions = {}): Promise<Donor[]> {
    return this.donorRepository.findMany(buildWhere(filters), options);
  }

  async countDonors(filters: DonorFilters = {}): Promise<number> {
    return this.donorRepository.count(buildWhere(filters));
  }
}

/** Une organisation s'affiche par sa raison sociale, une personne par son nom. */
export function buildDisplayName(donor: Donor): string {
  if (donor.organizationName && donor.organizationName.trim() !== '') {
    return donor.organizationName;
  }
  return `${donor.firstName} ${donor.lastName}`.trim();
}

function buildWhere(filters: DonorFilters): Prisma.DonorWhereInput {
  const where: Prisma.DonorWhereInput = {};

  if (filters.donorType) where.donorType = filters.donorType;
  if (filters.country) where.country = normalizeCountry(filters.country);

  if (filters.international !== undefined) {
    where.country = filters.international
      ? { not: ORGANIZATION_COUNTRY }
      : ORGANIZATION_COUNTRY;
  }

  if (filters.search && filters.search.trim() !== '') {
    const search = filters.search.trim();
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { organizationName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
}
