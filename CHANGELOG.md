# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - 2021-11-17
### Changed
- Version 3.0.0 is a complete rewrite designed to improve application startup times by lazily processing files as they are requested (instead of eagerly processing all files at application start).
- Because files are processed lazily as they are requested, many users should experience reduced memory footprints for their apps. 

## [2.9.0] - 2021-11-02
### Changed
- Replaced `react-tools` with `@babel/preset-react`.

## [2.8.0] - 2021-05-04
### Changed
- Replaced `uglify-es` with `uglify-js`.