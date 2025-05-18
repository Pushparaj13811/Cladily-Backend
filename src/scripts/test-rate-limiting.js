/**
 * Test script for rate limiting
 * 
 * This script tests the rate limiting implementation by making multiple requests
 * to different endpoints and checking if rate limits are enforced.
 * 
 * Usage:
 * node src/scripts/test-rate-limiting.js
 */

import fetch from 'node-fetch';
import ora from 'ora';
import chalk from 'chalk';

// Config
const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;
const ENDPOINTS = {
  root: '/',
  health: '/api/health',
  products: '/api/products',
  search: '/api/products?search=test',
  login: '/api/auth/login',
};

// Test parameters
const REQUESTS_PER_ENDPOINT = 30;
const DELAY_BETWEEN_REQUESTS_MS = 100;

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to make multiple requests to an endpoint
async function makeRequests(endpoint, count, headers = {}) {
  const results = {
    endpoint,
    count,
    successful: 0,
    rateLimited: 0,
    other: 0,
    responses: [],
  };

  const spinner = ora(`Testing ${endpoint}`).start();

  for (let i = 0; i < count; i++) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, { headers });
      const status = response.status;
      
      let errorMessage = null;
      if (status === 429) {
        // Rate limited
        results.rateLimited++;
        const retryAfter = response.headers.get('retry-after') || 'N/A';
        errorMessage = `Rate limited (Retry-After: ${retryAfter})`;
        
        const data = await response.json().catch(() => ({}));
        if (data.message) errorMessage += ` - ${data.message}`;
      } else if (status >= 200 && status < 300) {
        // Successful
        results.successful++;
      } else {
        // Other error
        results.other++;
        errorMessage = `Status: ${status}`;
      }
      
      results.responses.push({
        index: i + 1,
        status,
        error: errorMessage,
      });
      
      spinner.text = `Testing ${endpoint}: ${i + 1}/${count} requests (${results.successful} ok, ${results.rateLimited} rate limited)`;
      
      // Add delay between requests
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    } catch (error) {
      results.other++;
      results.responses.push({
        index: i + 1,
        error: error.message,
      });
      spinner.text = `Testing ${endpoint}: ${i + 1}/${count} requests (${results.successful} ok, ${results.rateLimited} rate limited)`;
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }
  }
  
  spinner.succeed(`Tested ${endpoint}: ${results.successful} ok, ${results.rateLimited} rate limited, ${results.other} errors`);
  return results;
}

// Main test function
async function runTests() {
  console.log(chalk.cyan.bold('Rate Limiting Test Script'));
  console.log(chalk.cyan(`Testing against ${BASE_URL}`));
  console.log(chalk.cyan(`Making ${REQUESTS_PER_ENDPOINT} requests to each endpoint with ${DELAY_BETWEEN_REQUESTS_MS}ms delay between requests\n`));
  
  const results = {};
  
  // Test each endpoint
  for (const [name, endpoint] of Object.entries(ENDPOINTS)) {
    results[name] = await makeRequests(endpoint, REQUESTS_PER_ENDPOINT);
    console.log(''); // Add a newline between tests
  }
  
  // Test the login endpoint with multiple failed attempts
  console.log(chalk.yellow.bold('Testing auth login rate limiting with invalid credentials:'));
  results.failedLogin = await makeRequests(ENDPOINTS.login, REQUESTS_PER_ENDPOINT, {
    'Content-Type': 'application/json',
  });
  
  // Print summary
  console.log(chalk.green.bold('\nTest Summary:'));
  
  for (const [name, result] of Object.entries(results)) {
    const rateLimitPercentage = Math.round((result.rateLimited / result.count) * 100);
    
    console.log(chalk.bold(`\n${name.toUpperCase()} (${result.endpoint}):`));
    console.log(`  Total requests: ${chalk.blue(result.count)}`);
    console.log(`  Successful: ${chalk.green(result.successful)}`);
    console.log(`  Rate limited: ${chalk.yellow(result.rateLimited)} (${rateLimitPercentage}%)`);
    console.log(`  Other errors: ${chalk.red(result.other)}`);
    
    if (result.rateLimited > 0) {
      const firstRateLimitedIndex = result.responses.findIndex(r => r.status === 429);
      if (firstRateLimitedIndex !== -1) {
        console.log(chalk.yellow(`  First rate limit after ${firstRateLimitedIndex + 1} requests`));
      }
    }
  }
}

// Run the tests
runTests().catch(error => {
  console.error(chalk.red('Error running tests:'), error);
  process.exit(1);
}); 