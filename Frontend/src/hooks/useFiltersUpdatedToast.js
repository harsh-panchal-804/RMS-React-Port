import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export const useFiltersUpdatedToast = ({
  filtersSignature,
  dataSignature,
  enabled = true,
  message = 'Filters updated',
}) => {
  const hasMounted = useRef(false);
  const prevFilters = useRef(filtersSignature);
  const prevData = useRef(dataSignature);
  const pendingFilterChange = useRef(false);
  const lastToastAt = useRef(0);

  useEffect(() => {
    if (!enabled) {
      prevFilters.current = filtersSignature;
      prevData.current = dataSignature;
      return;
    }

    if (!hasMounted.current) {
      hasMounted.current = true;
      prevFilters.current = filtersSignature;
      prevData.current = dataSignature;
      return;
    }

    const filterChanged = prevFilters.current !== filtersSignature;
    const dataChanged = prevData.current !== dataSignature;

    if (filterChanged) {
      pendingFilterChange.current = true;
    }

    if (pendingFilterChange.current && dataChanged) {
      const now = Date.now();
      if (now - lastToastAt.current > 600) {
        toast.success(message);
        lastToastAt.current = now;
      }
      pendingFilterChange.current = false;
    }

    prevFilters.current = filtersSignature;
    prevData.current = dataSignature;
  }, [dataSignature, enabled, filtersSignature, message]);
};
