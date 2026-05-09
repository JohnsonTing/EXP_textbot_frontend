import { useState } from "react";
import { useListContacts, useCreateContact, useUpdateContact, useDeleteContact } from "@workspace/api-client-react";
import type { Contact } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { format } from "date-fns";
import { Search, Plus, MoreHorizontal, Mail, Phone, Home, PoundSterling, BedDouble, MapPin, Building2, ExternalLink, Users, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { getListContactsQueryKey } from "@workspace/api-client-react";

// Form Schema
const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(5, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
  leadIntent: z.string().optional(),
  propertyInMind: z.string().optional(),
  bedrooms: z.coerce.number().optional(),
  budget: z.string().optional(),
  tags: z.string().transform(str => str.split(",").map(s => s.trim()).filter(Boolean)).optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [intentFilter, setIntentFilter] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);

  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
  
  const { data: contacts = [], isLoading } = useListContacts({
    search: search || undefined,
    leadIntent: intentFilter || undefined
  });

  const createContact = useCreateContact({
    mutation: {
      onSuccess: () => { invalidate(); setIsDialogOpen(false); form.reset(); }
    }
  });

  const updateContact = useUpdateContact({
    mutation: {
      onSuccess: () => { invalidate(); setEditContact(null); editForm.reset(); }
    }
  });

  const deleteContactMutation = useDeleteContact({
    mutation: {
      onSuccess: () => { invalidate(); setDeleteContact(null); }
    }
  });

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", phone: "", email: "", leadIntent: "", propertyInMind: "", budget: "", tags: [] }
  });

  const editForm = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = (data: ContactFormData) => {
    createContact.mutate({ data: { ...data, tags: data.tags || [] } });
  };

  const onEditSubmit = (data: ContactFormData) => {
    if (!editContact) return;
    updateContact.mutate({ id: encodeURIComponent(editContact.id), data: { ...data, tags: data.tags || [] } });
  };

  const openEdit = (contact: Contact) => {
    setEditContact(contact);
    editForm.reset({
      name: contact.name,
      phone: contact.phone,
      email: contact.email ?? "",
      leadIntent: contact.leadIntent ?? "",
      propertyInMind: contact.propertyInMind ?? "",
      budget: contact.budget ?? "",
      tags: contact.tags as unknown as string[],
    });
  };

  const getIntentColor = (intent?: string | null) => {
    switch(intent?.toLowerCase()) {
      case 'buyer': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'renter': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'landlord': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'vendor': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-8">
        
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">CRM Contacts</h1>
            <p className="text-muted-foreground mt-1">Manage and track your leads and clients.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-lg shadow-primary/20 gap-2">
                  <Plus size={18} /> Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-2xl border-border bg-card">
                <DialogHeader>
                  <DialogTitle className="text-xl font-display">Add New Contact</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Name *</label>
                      <Input {...form.register("name")} className="rounded-lg" placeholder="John Doe" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Phone *</label>
                      <Input {...form.register("phone")} className="rounded-lg" placeholder="+44 7000 000000" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email</label>
                      <Input {...form.register("email")} type="email" className="rounded-lg" placeholder="john@example.com" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Lead Intent</label>
                      <select {...form.register("leadIntent")} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <option value="">Select Intent</option>
                        <option value="buyer">Buyer</option>
                        <option value="renter">Renter</option>
                        <option value="vendor">Vendor</option>
                        <option value="landlord">Landlord</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Bedrooms</label>
                      <Input {...form.register("bedrooms")} type="number" className="rounded-lg" placeholder="3" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Budget</label>
                      <Input {...form.register("budget")} className="rounded-lg" placeholder="£500k" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tags (comma separated)</label>
                    <Input {...form.register("tags")} className="rounded-lg" placeholder="hot lead, central london, family" />
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancel</Button>
                    <Button type="submit" disabled={createContact.isPending} className="rounded-xl">
                      {createContact.isPending ? "Saving..." : "Save Contact"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input 
              placeholder="Search by name, email or phone..." 
              className="pl-10 rounded-xl bg-background/50 border-border/50 h-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <Button variant={intentFilter === "" ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setIntentFilter("")}>All</Button>
            <Button variant={intentFilter === "buyer" ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setIntentFilter("buyer")}>Buyers</Button>
            <Button variant={intentFilter === "renter" ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setIntentFilter("renter")}>Renters</Button>
            <Button variant={intentFilter === "vendor" ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setIntentFilter("vendor")}>Vendors</Button>
          </div>
        </div>

        {/* Contacts Table */}
        <div className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border/50">
                <tr>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Requirements</th>
                  <th className="px-6 py-4">Buyer / Tenant</th>
                  <th className="px-6 py-4">Created On</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-10 w-32 bg-muted rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-10 w-40 bg-muted rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-10 w-24 bg-muted rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-6 w-20 bg-muted rounded-full"></div></td>
                      <td className="px-6 py-4"><div className="h-4 w-20 bg-muted rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-8 w-8 bg-muted rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No contacts found matching your criteria</p>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 border border-border">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {contact.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="font-medium text-foreground">{contact.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone size={14} /> <span>{contact.phone}</span>
                        </div>
                        {contact.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail size={14} /> <span>{contact.email}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 space-y-1 text-muted-foreground">
                        {contact.enquiryPostcode && (
                          <div className="flex items-center gap-2" title="Postcode">
                            <MapPin size={14} /> <span>{contact.enquiryPostcode}</span>
                          </div>
                        )}
                        {contact.enquiryPropType && (
                          <div className="flex items-center gap-2" title="Property type">
                            <Building2 size={14} /> <span className="capitalize">{contact.enquiryPropType}</span>
                          </div>
                        )}
                        {(contact.bedrooms || contact.budget) && (
                          <div className="flex items-center gap-3">
                            {contact.bedrooms && <span className="flex items-center gap-1"><BedDouble size={14} /> {contact.bedrooms}</span>}
                            {contact.budget && <span className="flex items-center gap-1"><PoundSterling size={14} /> {contact.budget}</span>}
                          </div>
                        )}
                        {contact.propertyInMind && (
                          <div className="flex items-center gap-2" title="Property enquired about">
                            <Home size={14} />
                            {contact.propertyInMind.startsWith('http') ? (
                              <a href={contact.propertyInMind} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 truncate max-w-[140px]">
                                View listing <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span className="truncate max-w-[140px]">{contact.propertyInMind}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 space-y-2">
                        {(contact as any).customerType ? (
                          <Badge variant="secondary" className={`capitalize rounded-full ${getIntentColor((contact as any).customerType)} border-none shadow-sm`}>
                            {(contact as any).customerType}
                          </Badge>
                        ) : contact.leadIntent ? (
                          <Badge variant="secondary" className={`capitalize rounded-full ${getIntentColor(contact.leadIntent)} border-none shadow-sm`}>
                            {contact.leadIntent}
                          </Badge>
                        ) : null}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {contact.tags.map((tag, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded border border-border/50">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {format(new Date(contact.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal size={18} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => openEdit(contact)}>
                              <Pencil size={14} /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" onSelect={() => setDeleteContact(contact)}>
                              <Trash2 size={14} /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Edit Dialog */}
      <Dialog open={!!editContact} onOpenChange={(o) => { if (!o) setEditContact(null); }}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Edit Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name *</label>
                <Input {...editForm.register("name")} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone *</label>
                <Input {...editForm.register("phone")} className="rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input {...editForm.register("email")} type="email" className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Lead Intent</label>
                <select {...editForm.register("leadIntent")} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Select Intent</option>
                  <option value="buyer">Buyer</option>
                  <option value="renter">Renter</option>
                  <option value="vendor">Vendor</option>
                  <option value="landlord">Landlord</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bedrooms</label>
                <Input {...editForm.register("bedrooms")} type="number" className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Budget</label>
                <Input {...editForm.register("budget")} className="rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags (comma separated)</label>
              <Input {...editForm.register("tags")} className="rounded-lg" />
            </div>
            <div className="pt-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditContact(null)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={updateContact.isPending} className="rounded-xl">
                {updateContact.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteContact} onOpenChange={(o) => { if (!o) setDeleteContact(null); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete contact?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <span className="font-medium text-foreground">{deleteContact?.name}</span>. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteContact(null)} className="rounded-xl">Cancel</Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={deleteContactMutation.isPending}
              onClick={() => deleteContact && deleteContactMutation.mutate({ id: encodeURIComponent(deleteContact.id) })}
            >
              {deleteContactMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
