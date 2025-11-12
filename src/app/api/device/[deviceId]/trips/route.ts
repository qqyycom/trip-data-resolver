import { NextRequest, NextResponse } from "next/server";
import { queryTripsByDevice } from "@/lib/trips";

export async function GET(request: NextRequest, context: { params: Promise<{ deviceId: string }> }) {
  try {
    const { searchParams } = new URL(request.url);
    const { deviceId } = await context.params;
    const pageSize = Math.min(
      Number.parseInt(searchParams.get("limit") ?? "10", 10) || 10,
      50
    );
    const cursor = searchParams.get("cursor") ?? undefined;

    if (!deviceId) {
      return NextResponse.json({ message: "deviceId 缺失" }, { status: 400 });
    }

    const result = await queryTripsByDevice({
      deviceId,
      pageSize,
      cursor,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("查询设备行程失败", error);
    return NextResponse.json(
      { message: "查询设备行程失败" },
      { status: 500 }
    );
  }
}
