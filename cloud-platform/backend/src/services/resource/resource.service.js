import * as repo from '../../data/resource/resource.repository.js';

export async function getResourceInventory(params) {
  return repo.getResourceInventory(params);
}

export async function createResource(resource) {
  return repo.createResource(resource);
}

export async function getResourceSummary() {
  return repo.getResourceSummary();
}

export async function getResourceUsageTimeline(days) {
  return repo.getResourceUsageTimeline(days);
}

export async function getFloodPredictions(limit) {
  return repo.getFloodPredictions(limit);
}

export async function getResourceCategories() {
  return repo.getResourceCategories();
}
