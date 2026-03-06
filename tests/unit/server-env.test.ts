import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  getRoboflowDedicatedDeploymentName,
  isRoboflowDedicatedDeploymentEnabled,
  isRoboflowTrainingAutoDeployEnabled
} from "@/lib/env/server"

const ORIGINAL_ENV = { ...process.env }

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key]
    }
  }

  Object.assign(process.env, ORIGINAL_ENV)
}

describe("server env dedicated deployment toggles", () => {
  beforeEach(() => {
    resetEnv()
  })

  afterEach(() => {
    resetEnv()
  })

  it("treats dedicated deployment name false as disabled placeholder", () => {
    process.env.ROBOFLOW_DEDICATED_DEPLOYMENT_NAME = "false"

    expect(getRoboflowDedicatedDeploymentName()).toBe("")
  })

  it("enables dedicated deployment only when the toggle is true", () => {
    process.env.ROBOFLOW_USE_DEDICATED_DEPLOYMENT = "true"
    process.env.ROBOFLOW_TRAINING_AUTO_DEPLOY = "false"

    expect(isRoboflowDedicatedDeploymentEnabled()).toBe(true)
    expect(isRoboflowTrainingAutoDeployEnabled()).toBe(false)
  })

  it("keeps auto deploy off while dedicated deployment toggle is false", () => {
    process.env.ROBOFLOW_USE_DEDICATED_DEPLOYMENT = "false"
    process.env.ROBOFLOW_TRAINING_AUTO_DEPLOY = "true"

    expect(isRoboflowDedicatedDeploymentEnabled()).toBe(false)
    expect(isRoboflowTrainingAutoDeployEnabled()).toBe(false)
  })
})
