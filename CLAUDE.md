# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

## Project structure

TrailDiary is a monorepo for tracking hiking/trail activities with primary components:
├── apps/
│   ├── mobile/                    # React Native - mobile ui
│   └── web/                       # React - web ui
├── packages/
│   ├── core/                      # Business logic, GPX/FIT parsers
│   ├── db/                        # Offline DB schema
│   └── ui/                        # shared components
└── package.json

## Architecture

