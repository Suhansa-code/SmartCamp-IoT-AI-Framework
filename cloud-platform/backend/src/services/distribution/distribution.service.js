import * as repo from '../../data/distribution/distribution.repository.js';

export async function getDistributions(params) {
  return repo.getDistributions(params);
}

export async function getDistributionSummary(campId) {
  return repo.getDistributionSummary(campId);
}

export async function getDistributionByResourceType(campId) {
  return repo.getDistributionByResourceType(campId);
}

export async function getDistributionTimeline(campId, days) {
  return repo.getDistributionTimeline(campId, days);
}

export async function getCampList() {
  return repo.getCampList();
}

export async function getResourceTypes() {
  return repo.getResourceTypes();
}
