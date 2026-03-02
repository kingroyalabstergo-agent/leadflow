"use client"

import { useState, useEffect } from "react"
import { supabase, Lead, LeadActivity } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

export function LeadDetail({ lead, onUpdate }: { lead: Lead; onUpdate: () => void }) {
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [newNote, setNewNote] = useState("")
  const [newAction, setNewAction] = useState("called")
  const [newResult, setNewResult] = useState("")

  useEffect(() => {
    fetchActivities()
  }, [lead.id])

  const fetchActivities = async () => {
    const { data } = await supabase
      .from("lead_activities")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
    setActivities(data || [])
  }

  const updateStatus = async (status: string) => {
    await supabase.from("leads").update({ status, updated_at: new Date().toISOString() }).eq("id", lead.id)
    onUpdate()
  }

  const addActivity = async () => {
    if (!newResult && !newNote) return
    await supabase.from("lead_activities").insert({
      lead_id: lead.id,
      action: newAction,
      result: newResult || null,
      notes: newNote || null,
    })
    setNewNote("")
    setNewResult("")
    fetchActivities()
  }

  const scoreColor = lead.score >= 60 ? "text-green-400" : lead.score >= 30 ? "text-yellow-400" : "text-red-400"

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{lead.company_name}</CardTitle>
            {lead.website && (
              <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" className="text-xs text-blue-400 hover:underline">
                {lead.website}
              </a>
            )}
          </div>
          <span className={`text-3xl font-bold ${scoreColor}`}>{lead.score}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Status</p>
          <div className="flex gap-1 flex-wrap">
            {["new", "contacted", "interested", "rejected", "closed"].map(s => (
              <Button
                key={s}
                size="sm"
                variant={lead.status === s ? "default" : "outline"}
                className="text-xs h-7"
                onClick={() => updateStatus(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Contact Info */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Contact Info</p>
          {lead.ceo_name && (
            <div className="text-sm">
              <span className="text-muted-foreground">CEO:</span> {lead.ceo_name}
              {lead.ceo_phone && <span className="ml-2 text-blue-400">📞 {lead.ceo_phone}</span>}
              {lead.ceo_email && <span className="ml-2 text-blue-400">✉️ {lead.ceo_email}</span>}
            </div>
          )}
          {lead.cfo_name && (
            <div className="text-sm">
              <span className="text-muted-foreground">CFO:</span> {lead.cfo_name}
              {lead.cfo_phone && <span className="ml-2 text-blue-400">📞 {lead.cfo_phone}</span>}
              {lead.cfo_email && <span className="ml-2 text-blue-400">✉️ {lead.cfo_email}</span>}
            </div>
          )}
          {lead.phone && <div className="text-sm">📞 {lead.phone}</div>}
          {lead.email && <div className="text-sm">✉️ {lead.email}</div>}
          {!lead.ceo_name && !lead.cfo_name && !lead.phone && !lead.email && (
            <p className="text-sm text-muted-foreground italic">No contact info</p>
          )}
        </div>

        <Separator />

        {/* Details */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p>{lead.revenue_estimate ? `€${(lead.revenue_estimate / 1_000_000).toFixed(1)}M` : "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Industry</p>
            <p>{lead.industry || "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Currencies</p>
            <div className="flex gap-1 flex-wrap">
              {lead.currencies_used?.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Source</p>
            <p>{lead.source}</p>
          </div>
        </div>

        {lead.notes && (
          <>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{lead.notes}</p>
            </div>
          </>
        )}

        <Separator />

        {/* Add Activity */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Log Activity</p>
          <div className="flex gap-2">
            <Select value={newAction} onValueChange={setNewAction}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="called">Called</SelectItem>
                <SelectItem value="emailed">Emailed</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newResult} onValueChange={setNewResult}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_answer">No Answer</SelectItem>
                <SelectItem value="callback">Callback</SelectItem>
                <SelectItem value="interested">Interested</SelectItem>
                <SelectItem value="not_interested">Not Interested</SelectItem>
                <SelectItem value="meeting_booked">Meeting Booked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Notes..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="h-16 text-xs"
          />
          <Button size="sm" onClick={addActivity} className="w-full h-8 text-xs">
            Log Activity
          </Button>
        </div>

        {/* Activity History */}
        {activities.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">History</p>
            <div className="space-y-1 max-h-40 overflow-auto">
              {activities.map(a => (
                <div key={a.id} className="text-xs border border-border/50 rounded p-2">
                  <div className="flex justify-between">
                    <Badge variant="outline" className="text-[10px]">{a.action}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {a.result && <p className="mt-1 text-muted-foreground">Result: {a.result}</p>}
                  {a.notes && <p className="mt-1">{a.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
