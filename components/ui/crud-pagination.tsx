"use client";

import { Pagination } from "@heroui/react";

type PaginationToken = number | "start-ellipsis" | "end-ellipsis";

function getPageTokens(page: number, totalPages: number): PaginationToken[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const visiblePages = [...pages].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
  const tokens: PaginationToken[] = [];
  visiblePages.forEach((pageNumber, index) => {
    const previous = visiblePages[index - 1];
    if (previous && pageNumber - previous > 1) tokens.push(previous === 1 ? "start-ellipsis" : "end-ellipsis");
    tokens.push(pageNumber);
  });
  return tokens;
}

export type CrudPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  isDisabled?: boolean;
};

export function CrudPagination({ page, pageSize, total, onPageChange, isDisabled = false }: CrudPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const paginationDisabled = isDisabled || total === 0;

  return (
    <Pagination className="-mt-1! flex min-h-8 flex-wrap-reverse items-center justify-between gap-3 px-1" size="sm">
      <Pagination.Summary className="shrink-0 whitespace-nowrap px-3 text-xs font-medium leading-8 text-foreground/60">
        共 <span className="tabular-nums text-foreground/80">{total}</span> 条记录
      </Pagination.Summary>
      <Pagination.Content className="ml-auto flex-wrap items-center max-sm:ml-0 max-sm:w-full max-sm:justify-end">
        <Pagination.Item>
          <Pagination.Previous isDisabled={paginationDisabled || currentPage === 1} onPress={() => onPageChange(Math.max(1, currentPage - 1))}>
            <Pagination.PreviousIcon />
            <span>上一页</span>
          </Pagination.Previous>
        </Pagination.Item>
        {getPageTokens(currentPage, totalPages).map((token) => typeof token === "number" ? (
          <Pagination.Item className={token === currentPage ? undefined : "max-sm:hidden"} key={token}>
            <Pagination.Link isActive={token === currentPage} isDisabled={paginationDisabled} onPress={() => onPageChange(token)}>{token}</Pagination.Link>
          </Pagination.Item>
        ) : (
          <Pagination.Item className="max-sm:hidden" key={token}><Pagination.Ellipsis /></Pagination.Item>
        ))}
        <Pagination.Item>
          <Pagination.Next isDisabled={paginationDisabled || currentPage === totalPages} onPress={() => onPageChange(Math.min(totalPages, currentPage + 1))}>
            <span>下一页</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}
