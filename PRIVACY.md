# Privacy

This document describes what the extension stores and what leaves your browser. Sections marked as placeholders are completed as the features that create the data are released.

## What is stored locally

Today only the interface settings (UI language, output language and the notifications preference) are stored, in the extension's local storage. Nothing is stored outside your browser profile. Placeholder: profile, tracker and analysis data categories will be listed here when they are introduced.

## What leaves the browser

Today nothing leaves the browser. Placeholder: once analysis is available, the offer text and the profile data needed for the analysis are sent to the LLM provider you choose, using your own API key, only when you start an analysis. This section will name each party and trigger.

## API key storage

The API key you enter is stored unencrypted in the extension's local storage on your device. The extension does not transmit it anywhere except to the provider it belongs to. Treat your browser profile as sensitive.

## No telemetry

There is no telemetry, analytics, crash reporting or remote logging. The extension makes no network request that you did not trigger, and the repository checks fail if a telemetry dependency is added.

## Portal terms of service risk

Reading a job portal page on your behalf may conflict with that portal's terms of service. You accept that risk when you use the portal features. Placeholder: the in-product acknowledgement will be described here.
