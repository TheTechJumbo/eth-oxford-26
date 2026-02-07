.PHONY: dev

NETWORK ?= local

dev:
	NETWORK=$(NETWORK) ./dev
