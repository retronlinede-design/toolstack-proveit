export default function SequenceGroupOperationSummary({ operation, source, destination, affected, remaining, resulting }) {
  return (
    <dl className="grid gap-x-4 gap-y-1 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-700 dark:bg-neutral-800/60 sm:grid-cols-[auto_1fr]">
      <dt className="font-semibold text-neutral-600 dark:text-neutral-300">Operation</dt><dd>{operation}</dd>
      <dt className="font-semibold text-neutral-600 dark:text-neutral-300">Source</dt><dd>{source}</dd>
      {destination && <><dt className="font-semibold text-neutral-600 dark:text-neutral-300">Destination</dt><dd>{destination}</dd></>}
      <dt className="font-semibold text-neutral-600 dark:text-neutral-300">Records affected</dt><dd>{affected}</dd>
      {remaining != null && <><dt className="font-semibold text-neutral-600 dark:text-neutral-300">Remaining in source</dt><dd>{remaining}</dd></>}
      {resulting != null && <><dt className="font-semibold text-neutral-600 dark:text-neutral-300">Destination after operation</dt><dd>{resulting}</dd></>}
    </dl>
  );
}
