/**
 * Manifest MAIN-world content script for flow.google.com.
 * The SW re-injects the same bridge via executeScript if this loader never ran.
 */
import { installFlowMainBridge } from './mainBridge';

installFlowMainBridge();
